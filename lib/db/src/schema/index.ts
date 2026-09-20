import { pgTable, text, integer, timestamp, uuid, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// 1. profiles table
export const profiles = pgTable("profiles", {
  userId: text("user_id").primaryKey(),
  name: text("name").notNull().default("AWAKENED HUNTER"),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  xpToNext: integer("xp_to_next").notNull().default(1000),
  rank: text("rank").notNull().default("E"),
  streak: integer("streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  statStr: integer("stat_str").notNull().default(1),
  statInt: integer("stat_int").notNull().default(1),
  statStamina: integer("stat_stamina").notNull().default(1),
  statDiscipline: integer("stat_discipline").notNull().default(1),
  title: text("title").notNull().default("Unranked"),
  lockdownUntil: timestamp("lockdown_until", { withTimezone: true }),
  lastCompletedDate: text("last_completed_date"),
  journeyStartDate: text("journey_start_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// 2. quests table
export const quests = pgTable("quests", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => profiles.userId, { onDelete: "cascade" }),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  category: text("category").notNull().default("DISCIPLINE"),
  target: integer("target").notNull().default(1),
  unit: text("unit").notNull().default("set"),
  xp: integer("xp").notNull().default(25),
  stat: text("stat").notNull().default("DISCIPLINE"),
  weekdays: integer("weekdays").array().notNull(),
  isCustom: boolean("is_custom").notNull().default(false),
  rampKey: text("ramp_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 3. daily_completions table
export const dailyCompletions = pgTable("daily_completions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => profiles.userId, { onDelete: "cascade" }),
  questId: text("quest_id").notNull(),
  completedDate: text("completed_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_completion").on(table.userId, table.questId, table.completedDate),
]);

// 4. raids table
export const raids = pgTable("raids", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => profiles.userId, { onDelete: "cascade" }),
  name: text("name").notNull().default("The Architect's Trial"),
  detail: text("detail").notNull().default("Complete every active quest twice this week"),
  target: integer("target").notNull().default(0),
  unit: text("unit").notNull().default("completions"),
  xp: integer("xp").notNull().default(300),
  status: text("status").notNull().default("ACTIVE"),
  weekKey: text("week_key").notNull(),
  requiredQuestIds: text("required_quest_ids").array().notNull().default([]),
  evaluatedAt: timestamp("evaluated_at", { withTimezone: true }),
  isCurrent: boolean("is_current").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 5. rest_days table
export const restDays = pgTable("rest_days", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => profiles.userId, { onDelete: "cascade" }),
  day: integer("day").notNull(),
}, (table) => [
  uniqueIndex("uq_rest_day").on(table.userId, table.day),
]);

export const insertProfileSchema = createInsertSchema(profiles);
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;

export const insertQuestSchema = createInsertSchema(quests);
export type InsertQuest = z.infer<typeof insertQuestSchema>;
export type Quest = typeof quests.$inferSelect;

export const insertDailyCompletionSchema = createInsertSchema(dailyCompletions);
export type InsertDailyCompletion = z.infer<typeof insertDailyCompletionSchema>;
export type DailyCompletion = typeof dailyCompletions.$inferSelect;

export const insertRaidSchema = createInsertSchema(raids);
export type InsertRaid = z.infer<typeof insertRaidSchema>;
export type Raid = typeof raids.$inferSelect;

export const insertRestDaySchema = createInsertSchema(restDays);
export type InsertRestDay = z.infer<typeof insertRestDaySchema>;
export type RestDay = typeof restDays.$inferSelect;