
import {
    DeleteObjectCommand,
    S3Client,
} from "npm:@aws-sdk/client-s3";
import { createClient } from "npm:@supabase/supabase-js@2";

type DeleteMediaRequest = {
  kind?: "post";
  objectKey?: string;
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

function parsePostObjectKey(
  objectKey: string
) {
  const parts = objectKey.split("/");

  /*
   * Student:
   *
   * posts/users/<userId>/<file>
   */
  if (
    parts.length === 4 &&
    parts[0] === "posts" &&
    parts[1] === "users"
  ) {
    return {
      type: "student" as const,
      userId: parts[2],
    };
  }

  /*
   * Organization:
   *
   * posts/organizations/<organizationId>/<uploaderId>/<file>
   */
  if (
    parts.length === 5 &&
    parts[0] === "posts" &&
    parts[1] === "organizations"
  ) {
    return {
      type: "organization" as const,
      organizationId: parts[2],
      uploaderId: parts[3],
    };
  }

  return null;
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
    /*
     * 1. Authenticate
     */

    const authorization =
      req.headers.get("Authorization");

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
        getRequiredEnv("SUPABASE_URL"),
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
      return json(
        {
          error:
            "Invalid or expired session.",
        },
        401
      );
    }

    const currentUserId =
      userData.user.id;

    /*
     * 2. Validate request
     */

    const body =
      (await req.json()) as DeleteMediaRequest;

    if (body.kind !== "post") {
      return json(
        {
          error:
            "Unsupported media type.",
        },
        400
      );
    }

    const objectKey =
      body.objectKey?.trim();

    if (!objectKey) {
      return json(
        {
          error:
            "Missing media object key.",
        },
        400
      );
    }

    /*
     * Never allow arbitrary R2 keys.
     */

    const parsed =
      parsePostObjectKey(
        objectKey
      );

    if (!parsed) {
      return json(
        {
          error:
            "Invalid post media path.",
        },
        400
      );
    }

    /*
     * 3. Authorize deletion
     */

    if (
      parsed.type === "student"
    ) {
      if (
        parsed.userId !==
        currentUserId
      ) {
        return json(
          {
            error:
              "You cannot delete this media.",
          },
          403
        );
      }
    } else {
      /*
       * Organization post:
       * current user must currently hold
       * owner/admin/editor role.
       */

      const {
        data: membership,
        error: membershipError,
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
            parsed.organizationId
          )
          .eq(
            "user_id",
            currentUserId
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

      if (membershipError) {
        console.error(
          "[delete-media-object] Organization permission check failed.",
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
              "You cannot delete this organization media.",
          },
          403
        );
      }
    }

    /*
     * 4. R2 configuration
     */

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
          accessKeyId:
            getRequiredEnv(
              "R2_ACCESS_KEY_ID"
            ),
          secretAccessKey:
            getRequiredEnv(
              "R2_SECRET_ACCESS_KEY"
            ),
        },
      });

    /*
     * 5. Delete the object
     */

    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      })
    );

    return json({
      deleted: true,
    });
  } catch (error) {
    console.error(
      "[delete-media-object] Unexpected failure.",
      error
    );

    return json(
      {
        error:
          "Could not delete media.",
      },
      500
    );
  }
});