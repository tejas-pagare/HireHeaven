import { z } from "zod";

export const CreatePostSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  slug: z.string().min(3).optional(),
  tags: z.array(z.string()).optional(),
  cover_image: z.string().url().optional(),
  sections: z
    .array(
      z.object({
        id: z.string(),
        heading: z.string().optional(),
        content: z.string(),
        image: z.string().optional(),
        order: z.number(),
      })
    )
    .min(1, "At least one section is required"),
});

export const UpdatePostSchema = CreatePostSchema.partial();
