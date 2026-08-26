import {
    DeleteObjectCommand,
    S3Client,
} from "npm:@aws-sdk/client-s3";
import { createClient } from "npm:@supabase/supabase-js@2";

type DeleteMediaRequest = {
  kind?:
    | "avatar"
    | "event-image"
    | "organization-avatar"
    | "post";
  objectKey?: string;
  organizationId?: string;
  eventId?: string;
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

function parsePostObjectKey(
  objectKey: string
) {
  const parts =
    objectKey.split("/");

  if (
    parts.length === 4 &&
    parts[0] === "posts" &&
    parts[1] === "users" &&
    parts[2] &&
    parts[3]
  ) {
    return {
      type:
        "student" as const,
      userId:
        parts[2],
    };
  }

  if (
    parts.length === 5 &&
    parts[0] === "posts" &&
    parts[1] ===
      "organizations" &&
    parts[2] &&
    parts[3] &&
    parts[4]
  ) {
    return {
      type:
        "organization" as const,
      organizationId:
        parts[2],
      uploaderId:
        parts[3],
    };
  }

  return null;
}

function parseAvatarObjectKey(
  objectKey: string
) {
  const parts =
    objectKey.split("/");

  if (
    parts.length === 4 &&
    parts[0] === "avatars" &&
    parts[1] === "users" &&
    parts[2] &&
    parts[3]
  ) {
    return {
      userId:
        parts[2],
    };
  }

  return null;
}

function parseOrganizationAvatarObjectKey(
  objectKey: string
) {
  const parts =
    objectKey.split("/");

  if (
    parts.length === 4 &&
    parts[0] === "avatars" &&
    parts[1] ===
      "organizations" &&
    parts[2] &&
    parts[3]
  ) {
    return {
      organizationId:
        parts[2],
    };
  }

  return null;
}

function parseEventImageObjectKey(
  objectKey: string
) {
  const parts =
    objectKey.split("/");

  if (
    parts.length === 5 &&
    parts[0] === "events" &&
    parts[1] ===
      "organizations" &&
    parts[2] &&
    parts[3] &&
    parts[4]
  ) {
    return {
      organizationId:
        parts[2],
      eventId:
        parts[3],
    };
  }

  return null;
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

    const body =
      (await req.json()) as DeleteMediaRequest;

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
     * Student avatar
     */
    if (
      body.kind === "avatar"
    ) {
      const avatar =
        parseAvatarObjectKey(
          objectKey
        );

      if (!avatar) {
        return json(
          {
            error:
              "Invalid avatar media path.",
          },
          400
        );
      }

      if (
        avatar.userId !==
        currentUserId
      ) {
        return json(
          {
            error:
              "You cannot delete this avatar.",
          },
          403
        );
      }
    }

    /*
     * Organization avatar
     */
    if (
      body.kind ===
        "organization-avatar"
    ) {
      const avatar =
        parseOrganizationAvatarObjectKey(
          objectKey
        );

      if (!avatar) {
        return json(
          {
            error:
              "Invalid organization avatar path.",
          },
          400
        );
      }

      if (
        body.organizationId &&
        body.organizationId !==
          avatar.organizationId
      ) {
        return json(
          {
            error:
              "Organization does not match avatar path.",
          },
          400
        );
      }

      try {
        const role =
          await getOrganizationRole(
            supabase,
            avatar.organizationId,
            currentUserId
          );

        if (
          role !== "owner" &&
          role !== "admin"
        ) {
          return json(
            {
              error:
                "You cannot delete this organization avatar.",
            },
            403
          );
        }
      } catch (error) {
        console.error(
          "[delete-media-object] Organization avatar permission check failed.",
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
     * Event image
     */
    if (
      body.kind ===
        "event-image"
    ) {
      const parsed =
        parseEventImageObjectKey(
          objectKey
        );

      if (!parsed) {
        return json(
          {
            error:
              "Invalid event image path.",
          },
          400
        );
      }

      if (
        body.organizationId &&
        body.organizationId !==
          parsed.organizationId
      ) {
        return json(
          {
            error:
              "Organization does not match event image path.",
          },
          400
        );
      }

      if (
        body.eventId &&
        body.eventId !==
          parsed.eventId
      ) {
        return json(
          {
            error:
              "Event does not match event image path.",
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
                parsed.eventId,
              organizationId:
                parsed.organizationId,
              userId:
                currentUserId,
            }
          );

        if (!allowed) {
          return json(
            {
              error:
                "You cannot delete this event image.",
            },
            403
          );
        }
      } catch (error) {
        console.error(
          "[delete-media-object] Event permission check failed.",
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
     * Post media
     */
    if (
      body.kind === "post"
    ) {
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

      if (
        parsed.type ===
          "student"
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
        try {
          const role =
            await getOrganizationRole(
              supabase,
              parsed.organizationId,
              currentUserId
            );

          if (
            role !== "owner" &&
            role !== "admin" &&
            role !== "editor"
          ) {
            return json(
              {
                error:
                  "You cannot delete this organization media.",
              },
              403
            );
          }
        } catch (error) {
          console.error(
            "[delete-media-object] Organization post permission check failed.",
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
    }

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

    await s3.send(
      new DeleteObjectCommand({
        Bucket:
          bucket,
        Key:
          objectKey,
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