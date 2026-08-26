import "@supabase/functions-js/edge-runtime.d.ts";

import {
  PutObjectCommand,
  S3Client,
} from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_CONTENT_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/heic", "heic"],
  ["image/heif", "heif"],
]);

const MAX_POST_IMAGE_SIZE =
  8 * 1024 * 1024;

const MAX_AVATAR_IMAGE_SIZE =
  5 * 1024 * 1024;

type UploadRequest = {
  contentType?: string;
  eventId?: string | null;
  fileSize?: number;
  organizationId?: string | null;
  kind?:
    | "avatar"
    | "event-image"
    | "organization-avatar"
    | "post";
};

function getRequiredEnv(name: string) {
  const value =
    Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}`
    );
  }

  return value;
}

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "Content-Type":
          "application/json",
      },
    }
  );
}

function normalizeR2Endpoint(
  endpoint: string,
  bucket: string
) {
  let normalized = endpoint
    .trim()
    .replace(/\/+$/, "");

  if (
    normalized.endsWith(
      `/${bucket}`
    )
  ) {
    normalized =
      normalized.slice(
        0,
        -(bucket.length + 1)
      );
  }

  return normalized;
}

async function getOrganizationRole(
  supabase: ReturnType<
    typeof createClient
  >,
  organizationId: string,
  userId: string
) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "organization_members"
      )
      .select("role")
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "user_id",
        userId
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.role ?? null;
}

async function canManageEvent(
  supabase: ReturnType<
    typeof createClient
  >,
  {
    eventId,
    organizationId,
    userId,
  }: {
    eventId: string;
    organizationId: string;
    userId: string;
  }
) {
  const [
    role,
    eventResult,
  ] = await Promise.all([
    getOrganizationRole(
      supabase,
      organizationId,
      userId
    ),

    supabase
      .from("events")
      .select(
        "id, organization_id, created_by"
      )
      .eq(
        "id",
        eventId
      )
      .maybeSingle(),
  ]);

  if (
    eventResult.error
  ) {
    throw eventResult.error;
  }

  const event =
    eventResult.data;

  if (
    !event ||
    event.organization_id !==
      organizationId
  ) {
    return false;
  }

  if (
    role === "owner" ||
    role === "admin"
  ) {
    return true;
  }

  if (
    role === "editor" &&
    event.created_by ===
      userId
  ) {
    return true;
  }

  return false;
}

Deno.serve(async (req) => {
  if (
    req.method !== "POST"
  ) {
    return json(
      {
        error:
          "Method not allowed.",
      },
      405
    );
  }

  try {
    const authorization =
      req.headers.get(
        "Authorization"
      );

    if (
      !authorization?.startsWith(
        "Bearer "
      )
    ) {
      return json(
        {
          error:
            "Missing authorization token.",
        },
        401
      );
    }

    const accessToken =
      authorization.slice(
        "Bearer ".length
      );

    const supabase =
      createClient(
        getRequiredEnv(
          "SUPABASE_URL"
        ),
        getRequiredEnv(
          "SUPABASE_ANON_KEY"
        ),
        {
          global: {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          },
          auth: {
            persistSession:
              false,
            autoRefreshToken:
              false,
          },
        }
      );

    const {
      data: userData,
      error: userError,
    } =
      await supabase.auth.getUser(
        accessToken
      );

    if (
      userError ||
      !userData.user
    ) {
      console.warn(
        "[create-media-upload] Invalid user token.",
        userError
      );

      return json(
        {
          error:
            "Invalid or expired session.",
        },
        401
      );
    }

    const userId =
      userData.user.id;

    const body =
      (await req.json()) as UploadRequest;

    if (
      body.kind !== "post" &&
      body.kind !== "avatar" &&
      body.kind !==
        "organization-avatar" &&
      body.kind !==
        "event-image"
    ) {
      return json(
        {
          error:
            "Unsupported media type.",
        },
        400
      );
    }

    const contentType =
      body.contentType
        ?.toLowerCase() ??
      "";

    const extension =
      ALLOWED_CONTENT_TYPES.get(
        contentType
      );

    if (!extension) {
      return json(
        {
          error:
            "Unsupported image format.",
        },
        400
      );
    }

    const maxImageSize =
      body.kind === "post" ||
      body.kind ===
        "event-image"
        ? MAX_POST_IMAGE_SIZE
        : MAX_AVATAR_IMAGE_SIZE;

    if (
      typeof body.fileSize !==
        "number" ||
      body.fileSize <= 0 ||
      body.fileSize >
        maxImageSize
    ) {
      return json(
        {
          error:
            `Image must be smaller than ${
              maxImageSize /
              (1024 * 1024)
            } MB.`,
        },
        400
      );
    }

    /*
     * Organization post:
     * owner/admin/editor
     */
    if (
      body.kind === "post" &&
      body.organizationId
    ) {
      try {
        const role =
          await getOrganizationRole(
            supabase,
            body.organizationId,
            userId
          );

        if (
          role !== "owner" &&
          role !== "admin" &&
          role !== "editor"
        ) {
          return json(
            {
              error:
                "You cannot publish for this organization.",
            },
            403
          );
        }
      } catch (error) {
        console.error(
          "[create-media-upload] Organization post permission check failed.",
          error
        );

        return json(
          {
            error:
              "Could not verify organization permissions.",
          },
          500
        );
      }
    }

    /*
     * Organization avatar:
     * owner/admin only
     */
    if (
      body.kind ===
        "organization-avatar"
    ) {
      if (
        !body.organizationId
      ) {
        return json(
          {
            error:
              "Organization ID is required.",
          },
          400
        );
      }

      try {
        const role =
          await getOrganizationRole(
            supabase,
            body.organizationId,
            userId
          );

        if (
          role !== "owner" &&
          role !== "admin"
        ) {
          return json(
            {
              error:
                "You cannot edit this organization avatar.",
            },
            403
          );
        }
      } catch (error) {
        console.error(
          "[create-media-upload] Organization avatar permission check failed.",
          error
        );

        return json(
          {
            error:
              "Could not verify organization permissions.",
          },
          500
        );
      }
    }

    /*
     * Event image:
     *
     * owner/admin:
     * any event belonging to org
     *
     * editor:
     * only event they created
     */
    if (
      body.kind ===
        "event-image"
    ) {
      if (
        !body.organizationId ||
        !body.eventId
      ) {
        return json(
          {
            error:
              "Organization ID and event ID are required.",
          },
          400
        );
      }

      try {
        const allowed =
          await canManageEvent(
            supabase,
            {
              eventId:
                body.eventId,
              organizationId:
                body.organizationId,
              userId,
            }
          );

        if (!allowed) {
          return json(
            {
              error:
                "You cannot manage media for this event.",
            },
            403
          );
        }
      } catch (error) {
        console.error(
          "[create-media-upload] Event permission check failed.",
          error
        );

        return json(
          {
            error:
              "Could not verify event permissions.",
          },
          500
        );
      }
    }

    const accessKeyId =
      getRequiredEnv(
        "R2_ACCESS_KEY_ID"
      );

    const secretAccessKey =
      getRequiredEnv(
        "R2_SECRET_ACCESS_KEY"
      );

    const bucket =
      getRequiredEnv(
        "R2_BUCKET_NAME"
      );

    const endpoint =
      normalizeR2Endpoint(
        getRequiredEnv(
          "R2_ENDPOINT"
        ),
        bucket
      );

    const s3 =
      new S3Client({
        region: "auto",
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

    const objectId =
      crypto.randomUUID();

    let objectKey: string;

    if (
      body.kind === "avatar"
    ) {
      objectKey =
        `avatars/users/${userId}/${objectId}.${extension}`;
    } else if (
      body.kind ===
        "organization-avatar"
    ) {
      objectKey =
        `avatars/organizations/${body.organizationId}/${objectId}.${extension}`;
    } else if (
      body.kind ===
        "event-image"
    ) {
      objectKey =
        `events/organizations/${body.organizationId}/${body.eventId}/${objectId}.${extension}`;
    } else if (
      body.organizationId
    ) {
      objectKey =
        `posts/organizations/${body.organizationId}/${userId}/${objectId}.${extension}`;
    } else {
      objectKey =
        `posts/users/${userId}/${objectId}.${extension}`;
    }

    const command =
      new PutObjectCommand({
        Bucket:
          bucket,
        Key:
          objectKey,
        ContentType:
          contentType,
      });

    const uploadUrl =
      await getSignedUrl(
        s3,
        command,
        {
          expiresIn: 300,
        }
      );

    return json({
      contentType,
      objectKey,
      uploadUrl,
    });
  } catch (error) {
    console.error(
      "[create-media-upload] Unexpected failure.",
      error
    );

    return json(
      {
        error:
          "Could not create upload URL.",
      },
      500
    );
  }
});