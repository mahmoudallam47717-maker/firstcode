# مكتبنا — منصة إدارة المشاريع والدخل

منصة ويب عامة للعمل الحر: أي شخص يستطيع إنشاء حساب بالبريد الإلكتروني، متابعة مشاريعه ودخله، وتسجيل بيانات العميل والتسليم. مالك المنصة فقط يرى إدارة المستخدمين والدخل الإجمالي.

## التقنيات

| الطبقة | التقنية |
| --- | --- |
| Backend | Node.js + Express 4 |
| قاعدة البيانات | SQLite عبر `node:sqlite` المدمج (صفر اعتماديات وطنية) |
| المصادقة | JWT + bcryptjs + Rate limiting |
| التحقق | zod |
| أمان | helmet + CORS + Input validation |
| Frontend | SPA خفيفة (HTML/CSS/JS خام بدون build step) |
| الاختبارات | node:test (اختبارات API تكاملية) |

## المتطلبات

- Node.js **>= 22.5** (يستخدم `node:sqlite` المدمج)

## التشغيل السريع (Windows)

```bat
start.bat
```

أو يدويًا:

```bash
npm install
npm start        # http://localhost:3000
```

## الفكرة

- **أول تسجيل حساب** = مالك المنصة.
- التسجيل الذاتي يظل مفتوحًا، والحسابات التالية تبدأ كمستخدمين عاديين.
- الأدوار العملية هي: متخصص، وسيط، وعميل.
- الوسيط يختار المختص المنفذ بالاسم والبريد عند إنشاء المشروع، ويظهر المشروع للطرفين.
- العميل يختار الوسيط المسؤول، فيظهر الطلب تلقائيًا للعميل والوسيط والمختص داخل المنصة.
- تأكيد استلام الدخل متاح للمختص المعيّن فقط بعد استلام مستحقاته.
- الفريق وإدارة الدخل تظهران للمالك أو المشرف فقط.

## المميزات

### المشاريع
- كل مشروع ليه: اسم، **نوع** (بحث علمي / ديزاين / تقرير / عرض تقديمي / إعلان / أخرى)، **قيمة بالمبلغ**، حالة (معلّق / قيد التنفيذ / مُنجز)، ملاحظات.
- تشمل الأنواع البحثية، الكتابة، الترجمة، التفريغ والتعليق الصوتي، التصميم، البرمجة، المواقع، التطبيقات، التسويق، إدخال البيانات وغيرها.

### إدارة الدخل (للمالك)
- كل عضو يسجّل قيمة مشروعه بنفسه، ولما يكمّله بيبقى "دخل".
- **المدير لازم يؤكد** الدخل (زر "تأكيد") عشان يُحسب في "الدخل المؤكد".
- لوحة إدارة الدخل فيها **فلترة بالتاريخ** (اليوم / آخر 7 أيام / هذا الشهر / كل الفترة) عشان تعرف دخل أي فترة.
- قسم "مشاريع في انتظار التأكيد" بيجمّع كل المشاريع المنجزة غير المؤكدة ليتم تأكيدها بزر واحد.
- زرار **تصدير Excel (CSV)** للتقرير الكامل، وزر تصدير للمشاريع.

### الفريق (للمالك)
- إضافة/تعديل/حذف الأعضاء.
- تعديل الأسماء والباسوردات والصلاحيات في أي وقت.

## الأوامر

| أمر | الوصف |
| --- | --- |
| `npm start` | تشغيل الخادم |
| `npm run dev` | تشغيل مع إعادة تحميل تلقائي |
| `npm test` | تشغيل اختبارات API التكاملية |
| `npm run seed` | تعبئة بيانات تجريبية (مدير + موظف) |

## البنية

```
src/
  server.js              # نقطة الدخول، إعداد Express
  config.js              # قراءة الـ env
  db.js                  # SQLite + إنشاء الجداول والترقيات
  schemas.js             # كل مخططات zod
  seed.js                # بيانات تجريبية
  middleware/
    auth.js              # sign/verify JWT + requireAuth + requireAdmin
    errorHandler.js      # AppError + معالجة أخطاء
    validate.js          # validate(schema, source)
  routes/                # auth.js / projects.js / shifts.js / user.js
  services/              # authService.js / projectService.js / shiftService.js
public/                  # الواجهة (index.html / styles.css / app.js)
tests/api.test.js        # اختبارات تكاملية ضد خادم حقيقي
```

## API

| الطريقة | المسار | الوصف | الحماية |
| --- | --- | --- | --- |
| GET | `/api/auth/status` | هل التسجيل مفتوح (لا يوجد مستخدمين)؟ | عام |
| POST | `/api/auth/register` | إنشاء أول حساب (المدير) | Rate-limited |
| POST | `/api/auth/login` | تسجيل دخول | Rate-limited |
| GET | `/api/projects` | قائمة المشاريع (للمدير: كل المشاريع) | JWT |
| POST | `/api/projects` | إنشاء مشروع | JWT |
| PATCH | `/api/projects/:id` | تعديل مشروع | JWT |
| DELETE | `/api/projects/:id` | حذف مشروع | JWT |
| GET | `/api/projects/stats` | إحصائيات دخل العضو | JWT |
| GET | `/api/shifts` | شيفتات العضو + الشيفت النشط | JWT |
| POST | `/api/shifts/start` | فتح شيفت | JWT |
| POST | `/api/shifts/end` | إغلاق شيفت | JWT |
| GET | `/api/users/me` | بيانات العضو الحالي | JWT |
| GET | `/api/users/specialists` | قائمة المختصين المتاحين للتعيين | JWT |
| GET | `/api/users/intermediaries` | قائمة الوسطاء المتاحين لاستقبال الطلبات | JWT |
| PATCH | `/api/users/me` | تعديل اسمي | JWT |
| PATCH | `/api/users/me/password` | تغيير كلمة المرور | JWT |
| GET | `/api/users/admin/cashier` | دخل الفريق والمكتب (مع فلترة `from`/`to`) | JWT + admin |
| GET | `/api/users/admin/cashier.csv` | تصدير تقرير الكاشير CSV | JWT + admin |
| GET | `/api/projects/export.csv` | تصدير المشاريع CSV | JWT |
| GET | `/api/users/admin/users` | كل الأعضاء | JWT + admin |
| POST | `/api/users/admin/users` | إضافة عضو | JWT + admin |
| PATCH | `/api/users/admin/users/:id` | تعديل عضو | JWT + admin |
| DELETE | `/api/users/admin/users/:id` | حذف عضو | JWT + admin |
| POST | `/api/users/projects/:id/confirm` | تأكيد استلام الدخل للمختص المنفذ | JWT + assigned specialist |
| POST | `/api/users/projects/:id/approve` | اعتماد الطلب من المختص المنفذ | JWT + assigned specialist |

## ملاحظة أمان

كلمات المرور مخزنة بـ bcrypt، ومشاريع الموظف معزولة بحسب `user_id`، ومسارات الإدارة محمية بـ `requireAdmin` (صلاحية admin أو `can_manage`).

## إصلاح المشاكل

| المشكلة | الحل |
| --- | --- |
| مفتحتش المنصة | شغّل `start.bat` أو `npm start` ثم افتح http://localhost:3000 |
| "Invalid or expired token" | سجّل الدخول مجددًا |
| تريد البدء من جديد (داتا نظيفة) | أوقف الخادم واحذف مجلد `data/` ثم أعد التشغيل (يُعاد إنشاؤه تلقائيًا) |
