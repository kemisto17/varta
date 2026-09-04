import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  DeleteObjectCommand,
  S3Client,
} from "npm:@aws-sdk/client-s3";
import { createClient } from "npm:@supabase/supabase-js@2";

type DeleteMediaRequest = {
  kind?:
    | "avatar"
    | "event-image"
    | "lost-found"
    | "organization-avatar"
    | "post";
  objectKey?: string;
  organizationId?: string;
  eventId?: string;
};

type OrganizationRole =
  | "owner"
  | "admin"
  | "editor";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MEDIA_FILENAME_PATTERN =
  /^[a-z0-9-]+\.(jpg|jpeg|png|webp|heic|heif)$/i;

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

function isMediaFilename(
  value: string | null | undefined
) {
  return Boolean(
    value &&
      MEDIA_FILENAME_PATTERN.test(
        value
      )
  );
}

function parsePostObjectKey(
  objectKey: string
) {
  const parts =
    objectKey.split("/");

  /*
   * Student:
   *
   * posts/users/
   * <user-id>/
   * <uuid>.<ext>
   */
  if (
    parts.length === 4 &&
    parts[0] === "posts" &&
    parts[1] === "users" &&
    isUuid(parts[2]) &&
    isMediaFilename(parts[3])
  ) {
    return {
      type:
        "student" as const,
      userId:
        parts[2],
    };
  }

  /*
   * Organization:
   *
   * posts/organizations/
   * <organization-id>/
   * <uploader-id>/
   * <uuid>.<ext>
   */
  if (
    parts.length === 5 &&
    parts[0] === "posts" &&
    parts[1] ===
      "organizations" &&
    isUuid(parts[2]) &&
    isUuid(parts[3]) &&
    isMediaFilename(parts[4])
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

function parseLostFoundObjectKey(
  objectKey: string
) {
  const parts =
    objectKey.split("/");

  if (
    parts.length === 4 &&
    parts[0] === "lost-found" &&
    parts[1] === "users" &&
    isUuid(parts[2]) &&
    isMediaFilename(parts[3])
  ) {
    return {
      userId: parts[2],
    };
  }

  return null;
}

function parseAvatarObjectKey(
  objectKey: string
) {
  const parts =
    objectKey.split("/");

  /*
   * avatars/users/
   * <user-id>/
   * <uuid>.<ext>
   */
  if (
    parts.length === 4 &&
    parts[0] === "avatars" &&
    parts[1] === "users" &&
    isUuid(parts[2]) &&
    isMediaFilename(parts[3])
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

  /*
   * avatars/organizations/
   * <organization-id>/
   * <uuid>.<ext>
   */
  if (
    parts.length === 4 &&
    parts[0] === "avatars" &&
    parts[1] ===
      "organizations" &&
    isUuid(parts[2]) &&
    isMediaFilename(parts[3])
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

  /*
   * events/organizations/
   * <organization-id>/
   * <event-id>/
   * <uuid>.<ext>
   */
  if (
    parts.length === 5 &&
    parts[0] === "events" &&
    parts[1] ===
      "organizations" &&
    isUuid(parts[2]) &&
    isUuid(parts[3]) &&
    isMediaFilename(parts[4])
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

  /*
   * Organization operations must
   * remain inside the verified
   * student's university and only
   * work for active organizations.
   */
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

  /*
   * Owner/admin:
   * any event in the organization.
   */
  if (
    role === "owner" ||
    role === "admin"
  ) {
    return true;
  }

  /*
   * Editor:
   * only event they created.
   */
  return (
    role === "editor" &&
    event.created_by ===
      userId
  );
}

async function getVerifiedOrganizationRole(
  supabase: ReturnType<
    typeof createClient
  >,
  {
    organizationId,
    userId,
  }: {
    organizationId: string;
    userId: string;
  }
) {
  const universityId =
    await getVerifiedUniversityId(
      supabase,
      userId
    );

  if (!universityId) {
    return null;
  }

  return getOrganizationAccess(
    supabase,
    {
      organizationId,
      universityId,
      userId,
    }
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
        "[delete-media-object] Invalid user token.",
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

    const currentUserId =
      userData.user.id;

    const body =
      (await req.json()) as DeleteMediaRequest;

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
     * ========================================================
     * STUDENT AVATAR
     * ========================================================
     *
     * Verification is intentionally
     * not required for deleting an
     * object from your own namespace.
     *
     * This allows cleanup even if the
     * profile later loses verification.
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
     * ========================================================
     * POST MEDIA
     * ========================================================
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

      /*
       * Student post:
       * own namespace only.
       */
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
        /*
         * Organization post:
         *
         * verified student
         * + active organization
         * + same university
         * + owner/admin/editor
         */
        try {
          const role =
            await getVerifiedOrganizationRole(
              supabase,
              {
                organizationId:
                  parsed.organizationId,
                userId:
                  currentUserId,
              }
            );

          if (!role) {
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

    if (
      body.kind === "lost-found"
    ) {
      const parsed =
        parseLostFoundObjectKey(
          objectKey
        );

      if (!parsed) {
        return json(
          {
            error:
              "Invalid Lost & Found media path.",
          },
          400
        );
      }

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
          await getVerifiedOrganizationRole(
            supabase,
            {
              organizationId:
                avatar.organizationId,
              userId:
                currentUserId,
            }
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
     * ========================================================
     * EVENT IMAGE
     * ========================================================
     *
     * owner/admin:
     * any event in organization.
     *
     * editor:
     * only event they created.
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

      /*
       * Optional body metadata must
       * agree with the immutable R2
       * object key.
       */
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
        const role =
          await getVerifiedOrganizationRole(
            supabase,
            {
              organizationId:
                parsed.organizationId,
              userId:
                currentUserId,
            }
          );

        if (!role) {
          return json(
            {
              error:
                "You cannot manage media for this organization.",
            },
            403
          );
        }

        const allowed =
          await canManageEvent(
            supabase,
            {
              eventId:
                parsed.eventId,
              organizationId:
                parsed.organizationId,
              role,
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
     * ========================================================
     * R2 DELETE
     * ========================================================
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
