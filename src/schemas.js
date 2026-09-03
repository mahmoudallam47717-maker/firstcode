const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().trim().min(1, 'الاسم مطلوب').max(80),
  email: z.string().trim().email('البريد الإلكتروني غير صحيح').max(254),
  password: z.string().min(4, 'كلمة المرور قصيرة جداً (4 أحرف على الأقل)').max(128),
  persona: z.enum(['specialist', 'intermediary', 'client']).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email('البريد الإلكتروني غير صحيح'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});

const PROJECT_TYPES = [
  'research', 'report', 'presentation',
  'website', 'landing', 'ecommerce', 'platform', 'webapp',
  'software', 'app', 'mobile', 'tool',
  'design', 'logo', 'branding', 'ui', 'ux', 'animation', 'photo',
  'video', 'writing', 'ebook', 'course', 'script',
  'marketing', 'seo', 'socialmedia', 'ad',
  'data', 'excel', 'database', 'api', 'dashboard',
  'chatbot', 'automation', 'integration',
  'translation', 'voice', 'proof',
  'game', 'pos', 'erp', 'crm', 'blockchain',
  'other',
];
const projectTypeEnum = z.enum(PROJECT_TYPES);

const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'الصيغة YYYY-MM-DD').nullable().optional();
const timeSchema = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'الصيغة HH:MM مثل 09:00').nullable().optional();

const CURRENCIES = ['egp', 'sar', 'usd'];
const currencyEnum = z.enum(CURRENCIES);

const createProjectSchema = z.object({
  title: z.string().trim().min(1, 'اسم المشروع مطلوب').max(200),
  project_type: projectTypeEnum.optional(),
  amount: z.coerce.number().min(0).optional(),
  paid_amount: z.coerce.number().min(0).optional(),
  currency: currencyEnum.optional(),
  status: z.enum(['pending', 'in_progress', 'done']).optional(),
  notes: z.string().trim().max(2000).optional().default(''),
  phone: z.string().trim().max(20).optional().default(''),
  client_name: z.string().trim().max(100).optional().default(''),
  code: z.string().trim().max(50).optional().default(''),
  due_date: dateSchema,
  delivery_time: timeSchema,
  executor_id: z.coerce.number().int().positive().nullable().optional(),
  executor_code: z.string().trim().max(40).nullable().optional(),
  intermediary_id: z.coerce.number().int().positive().nullable().optional(),
  shift_id: z.coerce.number().int().positive().nullable().optional(),
});

const updateProjectSchema = z.object({
  title: z.string().trim().min(1, 'اسم المشروع مطلوب').max(200).optional(),
  project_type: projectTypeEnum.optional(),
  amount: z.coerce.number().min(0).optional(),
  paid_amount: z.coerce.number().min(0).optional(),
  currency: currencyEnum.optional(),
  status: z.enum(['pending', 'in_progress', 'done']).optional(),
  notes: z.string().trim().max(2000).optional(),
  phone: z.string().trim().max(20).optional(),
  client_name: z.string().trim().max(100).optional(),
  code: z.string().trim().max(50).optional(),
  due_date: dateSchema,
  delivery_time: timeSchema,
  executor_id: z.coerce.number().int().positive().nullable().optional(),
  executor_code: z.string().trim().max(40).nullable().optional(),
  intermediary_id: z.coerce.number().int().positive().nullable().optional(),
  shift_id: z.coerce.number().int().positive().nullable().optional(),
});

const projectQuerySchema = z.object({
  status: z.enum(['pending', 'in_progress', 'done']).optional(),
  project_type: projectTypeEnum.optional(),
  confirmed: z.enum(['true', 'false']).optional(),
  search: z.string().trim().max(200).optional(),
  code: z.string().trim().max(50).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'كلمة المرور الحالية مطلوبة'),
  newPassword: z.string().min(4, 'كلمة المرور الجديدة قصيرة').max(128),
});

const shiftTimeSchema = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'الصيغة HH:MM مثل 09:00').nullable().optional();

const adminCreateUserSchema = z.object({
  name: z.string().trim().min(1, 'الاسم مطلوب').max(80),
  email: z.string().trim().email('البريد الإلكتروني غير صحيح').max(254),
  password: z.string().min(4, 'كلمة المرور قصيرة').max(128),
  role: z.enum(['user', 'admin']).optional(),
  can_manage: z.coerce.boolean().optional(),
  persona: z.enum(['specialist', 'intermediary', 'client']).optional(),
  specialist_code: z.string().trim().max(40).optional(),
  shift_start: shiftTimeSchema,
  shift_end: shiftTimeSchema,
  hourly_rate: z.coerce.number().min(0).max(1000000).optional(),
  manual_deficit: z.coerce.number().min(0).max(100000000).optional(),
});

const adminUpdateUserSchema = z.object({
  name: z.string().trim().min(1, 'الاسم مطلوب').max(80).optional(),
  email: z.string().trim().email('البريد الإلكتروني غير صحيح').max(254).optional(),
  password: z.string().min(4, 'كلمة المرور قصيرة').max(128).optional(),
  role: z.enum(['user', 'admin']).optional(),
  can_manage: z.coerce.boolean().optional(),
  persona: z.enum(['specialist', 'intermediary', 'client']).optional(),
  specialist_code: z.string().trim().max(40).optional(),
  is_active: z.coerce.boolean().optional(),
  shift_start: shiftTimeSchema,
  shift_end: shiftTimeSchema,
  hourly_rate: z.coerce.number().min(0).max(1000000).optional(),
  manual_deficit: z.coerce.number().min(0).max(100000000).optional(),
});

module.exports = {
  registerSchema,
  loginSchema,
  createProjectSchema,
  updateProjectSchema,
  projectQuerySchema,
  changePasswordSchema,
  adminCreateUserSchema,
  adminUpdateUserSchema,
  PROJECT_TYPES,
  CURRENCIES,
};