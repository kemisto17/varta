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

const MAX_POST_IMAGE_SIZE = 8 * 1024 * 1024;

type UploadRequest = {
  contentType?: string;
  fileSize?: number;
  organizationId?: string | null;
  kind?: "post";
};

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();

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
        "Content-Type": "application/json",
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
    normalized = normalized.slice(
      0,
      -(bucket.length + 1)
    );
  }

  return normalized;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json(
      {
        error: "Method not allowed.",
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

    const supabaseUrl =
      getRequiredEnv(
        "SUPABASE_URL"
      );

    const supabaseAnonKey =
      getRequiredEnv(
        "SUPABASE_ANON_KEY"
      );

    const supabase =
      createClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          global: {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
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
      body.kind !== "post"
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
        ?.toLowerCase() ?? "";

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

    if (
      typeof body.fileSize !==
        "number" ||
      body.fileSize <= 0 ||
      body.fileSize >
        MAX_POST_IMAGE_SIZE
    ) {
      return json(
        {
          error:
            "Image must be smaller than 8 MB.",
        },
        400
      );
    }

    if (
      body.organizationId
    ) {
      const {
        data: membership,
        error:
          membershipError,
      } =
        await supabase
          .from(
            "organization_members"
          )
          .select(
            "organization_id"
          )
          .eq(
            "organization_id",
            body.organizationId
          )
          .eq(
            "user_id",
            userId
          )
          .in(
            "role",
            [
              "owner",
              "admin",
              "editor",
            ]
          )
          .maybeSingle();

      if (
        membershipError
      ) {
        console.error(
          "[create-media-upload] Organization permission check failed.",
          membershipError
        );

        return json(
          {
            error:
              "Could not verify organization permissions.",
          },
          500
        );
      }

      if (!membership) {
        return json(
          {
            error:
              "You cannot publish for this organization.",
          },
          403
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

    const objectKey =
      body.organizationId
        ? `posts/organizations/${body.organizationId}/${userId}/${objectId}.${extension}`
        : `posts/users/${userId}/${objectId}.${extension}`;

    const command =
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
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