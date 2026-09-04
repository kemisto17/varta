import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type MediaKind =
  | "avatar"
  | "event-image"
  | "lost-found"
  | "organization-avatar"
  | "post";

type OrganizationRole =
  | "owner"
  | "admin"
  | "editor";

type UploadRequest = {
  contentType?: string;
  eventId?: string | null;
  fileSize?: number;
  organizationId?: string | null;
  kind?: MediaKind;
};

function getRequiredEnv(
  name: string
) {
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

function isUuid(
  value: string | null | undefined
) {
  return Boolean(
    value &&
      UUID_PATTERN.test(value)
  );
}

/*
 * Returns the current user's university ID
 * only when their student profile is verified.
 */
async function getVerifiedUniversityId(
  supabase: ReturnType<
    typeof createClient
  >,
  userId: string
) {
  const {
    data,
    error,
  } =
    await supabase
      .from("profiles")
      .select(`
        is_verified,
        institute:institutes!profiles_institute_id_fkey (
          university_id
        )
      `)
      .eq(
        "id",
        userId
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (
    !data ||
    data.is_verified !== true
  ) {
    return null;
  }

  const institute =
    Array.isArray(
      data.institute
    )
      ? data.institute[0]
      : data.institute;

  return (
    institute?.university_id ??
    null
  );
}

/*
 * Validates:
 *
 * - current membership
 * - allowed role
 * - active organization
 * - same university
 */
async function getOrganizationAccess(
  supabase: ReturnType<
    typeof createClient
  >,
  {
    organizationId,
    universityId,
    userId,
  }: {
    organizationId: string;
    universityId: string;
    userId: string;
  }
): Promise<OrganizationRole | null> {
  const [
    membershipResult,
    organizationResult,
  ] = await Promise.all([
    supabase
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
      .maybeSingle(),

    supabase
      .from("organizations")
      .select(
        "id, university_id, is_active"
      )
      .eq(
        "id",
        organizationId
      )
      .maybeSingle(),
  ]);

  if (
    membershipResult.error
  ) {
    throw membershipResult.error;
  }

  if (
    organizationResult.error
  ) {
    throw organizationResult.error;
  }

  const organization =
    organizationResult.data;

  const role =
    membershipResult.data
      ?.role ?? null;

  if (
    !organization ||
    organization.is_active !==
      true ||
    organization.university_id !==
      universityId
  ) {
    return null;
  }

  if (
    role !== "owner" &&
    role !== "admin" &&
    role !== "editor"
  ) {
    return null;
  }

  return role;
}

/*
 * Event permissions:
 *
 * owner/admin:
 *   any event in organization
 *
 * editor:
 *   only event they created
 */
async function canManageEvent(
  supabase: ReturnType<
    typeof createClient
  >,
  {
    eventId,
    organizationId,
    role,
    userId,
  }: {
    eventId: string;
    organizationId: string;
    role: OrganizationRole;
    userId: string;
  }
) {
  const {
    data: event,
    error,
  } =
    await supabase
      .from("events")
      .select(
        "id, organization_id, created_by"
      )
      .eq(
        "id",
        eventId
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

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

  return (
    role === "editor" &&
    event.created_by ===
      userId
  );
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
    /*
     * ========================================================
     * AUTHENTICATION
     * ========================================================
     */

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

    /*
     * ========================================================
     * REQUEST VALIDATION
     * ========================================================
     */

    let body: UploadRequest;

    try {
      body =
        (await req.json()) as UploadRequest;
    } catch {
      return json(
        {
          error:
            "Invalid request body.",
        },
        400
      );
    }

    if (
      body.kind !== "post" &&
      body.kind !== "avatar" &&
      body.kind !== "lost-found" &&
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
        ?.trim()
        .toLowerCase() ??
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
      body.kind === "lost-found" ||
      body.kind ===
        "event-image"
        ? MAX_POST_IMAGE_SIZE
        : MAX_AVATAR_IMAGE_SIZE;

    if (
      typeof body.fileSize !==
        "number" ||
      !Number.isSafeInteger(
        body.fileSize
      ) ||
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
     * ========================================================
     * VERIFIED CAMPUS ACCOUNT
     * ========================================================
     *
     * New social media uploads require
     * a verified student account.
     */

    let universityId:
      | string
      | null;

    try {
      universityId =
        await getVerifiedUniversityId(
          supabase,
          userId
        );
    } catch (error) {
      console.error(
        "[create-media-upload] Verification check failed.",
        error
      );

      return json(
        {
          error:
            "Could not verify your campus account.",
        },
        500
      );
    }

    if (!universityId) {
      return json(
        {
          error:
            "A verified campus account is required to upload media.",
        },
        403
      );
    }

    /*
     * ========================================================
     * ORGANIZATION AUTHORIZATION
     * ========================================================
     */

    let organizationRole:
      | OrganizationRole
      | null = null;

    const isOrganizationScoped =
      body.kind ===
        "organization-avatar" ||
      body.kind ===
        "event-image" ||
      (
        body.kind === "post" &&
        Boolean(
          body.organizationId
        )
      );

    if (isOrganizationScoped) {
      if (
        !isUuid(
          body.organizationId
        )
      ) {
        return json(
          {
            error:
              "A valid organization ID is required.",
          },
          400
        );
      }

      try {
        organizationRole =
          await getOrganizationAccess(
            supabase,
            {
              organizationId:
                body.organizationId!,
              universityId,
              userId,
            }
          );
      } catch (error) {
        console.error(
          "[create-media-upload] Organization permission check failed.",
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

      if (!organizationRole) {
        return json(
          {
            error:
              "You cannot upload media for this organization.",
          },
          403
        );
      }
    }

    /*
     * ========================================================
     * ORGANIZATION AVATAR
     * ========================================================
     *
     * owner/admin only.
     */

    if (
      body.kind ===
        "organization-avatar"
    ) {
      if (
        organizationRole !==
          "owner" &&
        organizationRole !==
          "admin"
      ) {
        return json(
          {
            error:
              "You cannot edit this organization avatar.",
          },
          403
        );
      }
    }

    /*
     * ========================================================
     * EVENT IMAGE
     * ========================================================
     */

    if (
      body.kind ===
        "event-image"
    ) {
      if (
        !isUuid(
          body.eventId
        )
      ) {
        return json(
          {
            error:
              "A valid event ID is required.",
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
                body.eventId!,
              organizationId:
                body.organizationId!,
              role:
                organizationRole!,
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

    /*
     * ========================================================
     * R2 CLIENT
     * ========================================================
     */

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

    /*
     * ========================================================
     * OBJECT KEY
     * ========================================================
     */

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
      body.kind ===
        "lost-found"
    ) {
      objectKey =
        `lost-found/users/${userId}/${objectId}.${extension}`;
    } else if (
      body.organizationId
    ) {
      objectKey =
        `posts/organizations/${body.organizationId}/${userId}/${objectId}.${extension}`;
    } else {
      objectKey =
        `posts/users/${userId}/${objectId}.${extension}`;
    }

    /*
     * ========================================================
     * PRESIGNED PUT
     * ========================================================
     *
     * The signature is tied to:
     *
     * - object key
     * - content type
     * - exact content length
     *
     * so a client cannot ask permission
     * for a small JPEG and then upload an
     * arbitrary larger object instead.
     */

    const command =
      new PutObjectCommand({
        Bucket:
          bucket,
        Key:
          objectKey,
        ContentType:
          contentType,
        ContentLength:
          body.fileSize,
      });

    const uploadUrl =
      await getSignedUrl(
        s3,
        command,
        {
          expiresIn: 300,

          signableHeaders:
            new Set([
              "content-length",
              "content-type",
            ]),
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
