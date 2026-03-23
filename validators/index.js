import { z } from "zod";

const emptyToUndefined = (value) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  return value;
};

const toNumber = (value) => {
  const sanitized = emptyToUndefined(value);
  if (sanitized === undefined) {
    return undefined;
  }
  if (typeof sanitized === "number") {
    return sanitized;
  }
  if (typeof sanitized === "string") {
    const parsed = Number(sanitized);
    return Number.isFinite(parsed) ? parsed : sanitized;
  }
  return sanitized;
};

const toBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
    }
  }
  return value;
};

const toArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        return JSON.parse(trimmed);
      } catch (error) {
        return [trimmed];
      }
    }
    return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return value;
};

const parseJsonIfString = (value) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      return value;
    }
  }
  return value;
};

const slugSchema = z
  .string()
  .trim()
  .min(1, "slug is required")
  .max(64, "slug is too long");

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid id format");

const emailSchema = z.string().trim().email("Invalid email address");

const gmailOnlySchema = emailSchema.refine(
  (value) => value.toLowerCase().endsWith("@gmail.com"),
  {
    message: "Only Gmail addresses are allowed",
  }
);

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long");

const otpSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{6}$/, "Code must be a 6-digit number");

const buildNumberShape = ({ label, min, max, isInt } = {}) => {
  let shape = z.number({
    invalid_type_error: `${label ?? "Value"} must be a number`,
  });

  if (isInt) {
    shape = shape.refine(Number.isInteger, {
      message: `${label ?? "Value"} must be an integer`,
    });
  }

  if (typeof min === "number") {
    shape = shape.min(min, `${label ?? "Value"} must be at least ${min}`);
  }
  if (typeof max === "number") {
    shape = shape.max(max, `${label ?? "Value"} must be at most ${max}`);
  }

  return shape;
};

const intSchema = ({ label, min, max, optional } = {}) => {
  let schema = z.preprocess(toNumber, buildNumberShape({ label, min, max, isInt: true }));
  if (optional) {
    schema = schema.optional();
  }
  return schema;
};

const numberSchema = ({ label, min, max, optional } = {}) => {
  let schema = z.preprocess(toNumber, buildNumberShape({ label, min, max }));
  if (optional) {
    schema = schema.optional();
  }
  return schema;
};

const booleanSchema = z.preprocess(toBoolean, z.boolean());

const optionalTrimmedString = (label, max = 120) =>
  z
    .preprocess(emptyToUndefined, z.string().trim().min(1, `${label} is required`).max(max, `${label} must be at most ${max} characters`))
    .optional();

const optionalLooseString = (label, max = 200) =>
  z
    .preprocess(emptyToUndefined, z.string().trim().max(max, `${label} must be at most ${max} characters`))
    .optional();

const optionalPhoneSchema = z
  .preprocess(emptyToUndefined, z.string().trim().regex(/^[0-9+()\-_.\s]{6,20}$/, "Invalid phone number"))
  .optional();

const optionalGenderSchema = optionalLooseString("gender", 16);
const optionalHandleSchema = optionalLooseString("handle", 64);

const authorizerSchema = z
  .object({
    name: z.string().trim().min(1, "Authorizer name is required").max(120),
    role: z.string().trim().min(1, "Authorizer role is required").max(120),
  })
  .strict();

const authorizersSchema = z
  .preprocess((value) => {
    if (!value) {
      return undefined;
    }
    const parsedValue = parseJsonIfString(value);
    if (Array.isArray(parsedValue)) {
      return parsedValue.map((entry) => {
        if (typeof entry === "string") {
          return parseJsonIfString(entry);
        }
        return entry;
      });
    }
    return parsedValue;
  }, z.array(authorizerSchema).max(3, "Maximum 3 authorizers are allowed"))
  .optional();

const classrollSchema = intSchema({ label: "classroll", min: 1 });

const dateTimeSchema = z
  .preprocess(emptyToUndefined, z.string().datetime({ offset: true }))
  .refine((value) => !!value, { message: "A valid ISO date string is required" });

const teamMembersSchema = z.preprocess(
  toArray,
  z
    .array(emailSchema)
    .min(1, "At least one member is required")
    .max(10, "A maximum of 10 members is allowed")
);

const memberDescriptorSchema = z
  .preprocess((value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (/^[a-fA-F0-9]{24}$/.test(trimmed)) {
        return { userId: trimmed };
      }
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        return { classroll: numeric };
      }
      return { userId: trimmed };
    }
    if (typeof value === "number") {
      return { classroll: value };
    }
    return value;
  }, z.object({
    userId: objectIdSchema.optional(),
    classroll: intSchema({ label: "classroll", min: 1, optional: true }),
    status: booleanSchema.optional(),
  }))
  .refine((val) => val.userId || val.classroll, {
    message: "Each member entry must include userId or classroll",
  });

const productsSchema = z
  .array(
    z
      .object({
        description: z
          .string()
          .trim()
          .min(1, "Product description is required")
          .max(200, "Product description must be at most 200 characters"),
        quantity: intSchema({ label: "quantity", min: 1, optional: true }).default(1),
        unitPrice: numberSchema({ label: "unitPrice", min: 0 }),
      })
      .strict()
  )
  .min(1, "At least one product line is required");

const paginationNumberSchema = intSchema({ label: "value", min: 0, optional: true });

export const commonSchemas = {
  slug: slugSchema,
  objectId: objectIdSchema,
  objectIdParam: z.object({ id: objectIdSchema }),
};

export const userSchemas = {
  superAdminLogin: z
    .object({
      email: emailSchema,
      password: z.string().min(1, "Password is required"),
    })
    .strict(),
  register: z
    .object({
      classroll: classrollSchema,
      email: gmailOnlySchema,
      password: passwordSchema,
    })
    .strict(),
  login: z
    .object({
      classroll: classrollSchema,
      password: z.string().min(1, "Password is required"),
    })
    .strict(),
  slugOnly: z.object({ slug: slugSchema }).strict(),
  verifyUser: z
    .object({
      slug: slugSchema,
      code: otpSchema,
    })
    .strict(),
  forgotPassword: z.object({ email: emailSchema }).strict(),
  recoverPassword: z
    .object({
      email: emailSchema,
      code: otpSchema,
      password: passwordSchema,
    })
    .strict(),
  updateProfile: z
    .object({
      slug: slugSchema,
      name: optionalLooseString("name", 120),
      phone: optionalPhoneSchema,
      gender: optionalGenderSchema,
      tshirt: optionalLooseString("tshirt", 8),
      batch: intSchema({ label: "batch", min: 1900, max: 2100, optional: true }),
      dept: optionalLooseString("dept", 120),
      cfhandle: optionalHandleSchema,
      atchandle: optionalHandleSchema,
      cchandle: optionalHandleSchema,
    })
    .strict(),
  getUserData: z.object({ slug: slugSchema }).strict(),
  updateMembership: z
    .object({
      slug: slugSchema,
      membership: booleanSchema,
      durationInMonths: intSchema({ label: "durationInMonths", min: 1, max: 3, optional: true }),
    })
    .strict()
    .superRefine((data, ctx) => {
      if (data.membership && !data.durationInMonths) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["durationInMonths"],
          message: "durationInMonths is required when membership is enabled",
        });
      }
      if (!data.membership && data.durationInMonths) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["durationInMonths"],
          message: "durationInMonths should be omitted when membership is disabled",
        });
      }
    }),
  updateTitle: z
    .object({
      slug: slugSchema,
      title: z.enum(['GS', 'JS', 'OS', 'Member'], {
        errorMap: () => ({ message: "title must be one of: GS, JS, OS, Member" }),
      }),
    })
    .strict(),
  toggleAdmin: z
    .object({
      slug: slugSchema,
      isAdmin: booleanSchema,
    })
    .strict(),
  toggleTreasurer: z
    .object({
      slug: slugSchema,
      isTreasurer: booleanSchema,
    })
    .strict(),
};

export const padSchemas = {
  send: z
    .object({
      slug: slugSchema,
      receiverEmail: emailSchema,
      subject: optionalLooseString("subject", 180),
      statement: z
        .string()
        .trim()
        .min(10, "statement must be at least 10 characters"),
      authorizers: authorizersSchema,
      contactEmail: emailSchema.optional(),
      contactPhone: optionalPhoneSchema,
      address: optionalLooseString("address", 240),
    })
    .strict(),
  download: z
    .object({
      slug: slugSchema,
      authorizers: authorizersSchema,
      contactEmail: emailSchema.optional(),
      contactPhone: optionalPhoneSchema,
      address: optionalLooseString("address", 240),
    })
    .strict(),
};

export const invoiceSchemas = {
  send: z
    .object({
      slug: slugSchema,
      receiverEmail: emailSchema,
      subject: optionalLooseString("subject", 180),
      products: productsSchema,
      authorizerName: optionalLooseString("authorizerName", 120),
      authorizerDesignation: optionalLooseString("authorizerDesignation", 160),
      contactEmail: emailSchema.optional(),
      contactPhone: optionalPhoneSchema,
      address: optionalLooseString("address", 240),
    })
    .strict(),
  download: z
    .object({
      slug: slugSchema,
      products: productsSchema,
      authorizerName: optionalLooseString("authorizerName", 120),
      authorizerDesignation: optionalLooseString("authorizerDesignation", 160),
      contactEmail: emailSchema.optional(),
      contactPhone: optionalPhoneSchema,
      address: optionalLooseString("address", 240),
    })
    .strict(),
};

export const certificateSchemas = {
  send: z
    .object({
      slug: slugSchema,
      receiverEmail: emailSchema,
      subject: optionalLooseString('subject', 180).optional(),
      recipientName: z.string().trim().min(1, 'recipientName is required').max(200),
      certificateType: optionalLooseString('certificateType', 64).optional(),
      placement: optionalLooseString('placement', 64).optional(),
      eventName: optionalLooseString('eventName', 160).optional(),
      eventYear: optionalLooseString('eventYear', 32).optional(),
      issueDate: optionalLooseString('issueDate', 64).optional(),
      organizationName: optionalLooseString('organizationName', 160).optional(),
      subtitle: optionalLooseString('subtitle', 240).optional(),
      description: optionalLooseString('description', 2000).optional(),
      signatures: authorizersSchema, // metadata for signatures (name, role)
    })
    .strict(),
  download: z
    .object({
      slug: slugSchema,
      recipientName: z.string().trim().min(1, 'recipientName is required').max(200),
      certificateType: optionalLooseString('certificateType', 64).optional(),
      placement: optionalLooseString('placement', 64).optional(),
      eventName: optionalLooseString('eventName', 160).optional(),
      eventYear: optionalLooseString('eventYear', 32).optional(),
      issueDate: optionalLooseString('issueDate', 64).optional(),
      organizationName: optionalLooseString('organizationName', 160).optional(),
      subtitle: optionalLooseString('subtitle', 240).optional(),
      description: optionalLooseString('description', 2000).optional(),
      signatures: authorizersSchema,
    })
    .strict(),
};

export const eventSchemas = {
  addEvent: z
    .object({
      slug: slugSchema,
      eventName: z.string().trim().min(3, "eventName is required").max(150),
      eventType: z.enum(["solo", "team"], {
        errorMap: () => ({ message: "eventType must be solo or team" }),
      }),
      date: dateTimeSchema,
      registrationDeadline: dateTimeSchema,
      location: optionalLooseString("location", 160),
      description: optionalLooseString("description", 2000),
      needMembership: booleanSchema,
    })
    .strict(),
  updateEvent: z
    .object({
      slug: slugSchema,
      eventName: optionalLooseString("eventName", 150),
      date: optionalLooseString("date", 64),
      description: optionalLooseString("description", 2000),
      location: optionalLooseString("location", 160),
      registrationDeadline: optionalLooseString("registrationDeadline", 64),
    })
    .strict(),
  deleteEvent: z.object({ slug: slugSchema }).strict(),
  uploadGallery: z.object({ slug: slugSchema }).strict(),
  registerSolo: z
    .object({
      slug: slugSchema,
      Name: z.string().trim().min(1, "Name is required").max(120),
    })
    .strict(),
  registerTeam: z
    .object({
      slug: slugSchema,
      teamName: z.string().trim().min(1, "teamName is required").max(120),
      members: teamMembersSchema,
    })
    .strict(),
  updatePayment: z
    .object({
      slug: slugSchema,
      members: z.array(memberDescriptorSchema).min(1, "At least one member is required"),
      paymentStatus: booleanSchema.optional(),
    })
    .strict()
    .superRefine((data, ctx) => {
      if (data.paymentStatus === undefined) {
        data.members.forEach((member, index) => {
          if (member.status === undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["members", index, "status"],
              message: "Provide status for each member or use paymentStatus",
            });
          }
        });
      }
    }),
  registerParams: z.object({ id: objectIdSchema }),
};

export const notificationSchemas = {
  notifyAll: z
    .object({
      slug: slugSchema,
      title: z.string().trim().min(1, "title is required").max(120),
      message: z.string().trim().min(1, "message is required").max(500),
    })
    .strict(),
  notifyOneParams: z.object({ token: z.string().trim().min(10, "token is required") }),
};

export const chatSchemas = {
  getMessages: z
    .object({
      slug: slugSchema,
      limit: paginationNumberSchema,
      skip: paginationNumberSchema,
    })
    .strict(),
};
