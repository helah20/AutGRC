<div dir="rtl">

# قاعدة معرفة محلية باستخدام n8n

قاعدة معرفة تعمل بالكامل على جهازك، بدون أي خدمة سحابية: ترفع مستنداتك
(سياسات، معايير، إجراءات…) ثم تسألها بالعربية أو الإنجليزية، فتأتيك الإجابة
من مستنداتك فقط مع ذكر اسم الملف الذي استُخرجت منه.

| المكوّن | الدور |
| --- | --- |
| **n8n** | يشغّل سير العمل (رفع المستندات + المحادثة) — http://localhost:5678 |
| **Qdrant** | قاعدة بيانات المتجهات التي تُخزَّن فيها مقاطع المستندات — http://localhost:6333/dashboard |
| **Ollama** | يشغّل النماذج محليًا: `qwen2.5:7b` للمحادثة و`bge-m3` للتضمين (يدعمان العربية) |

```
رفع ملف ──► تقسيم إلى مقاطع ──► تضمين (bge-m3) ──► Qdrant
سؤال ──► وكيل AI (qwen2.5) ──► بحث في Qdrant ──► إجابة + اسم الملف
```

## المتطلبات

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (ويندوز/ماك) أو Docker Engine + Compose (لينكس).
- ذاكرة 16GB تقريبًا لنموذج `qwen2.5:7b` ونحو 8GB مساحة للنماذج.
  إن كانت الذاكرة أقل فاستعمل `CHAT_MODEL=qwen2.5:3b` في `.env`.

## التشغيل

```bash
cd knowledge-base
cp .env.example .env
# ضع مفتاحًا عشوائيًا في N8N_ENCRYPTION_KEY داخل .env، ولّده بـ:
openssl rand -hex 32
```

ثم اختر **واحدًا** مما يلي:

| جهازك | الأمر |
| --- | --- |
| ويندوز/لينكس بدون كرت NVIDIA | `docker compose --profile cpu up -d` |
| كرت NVIDIA | `docker compose --profile gpu-nvidia up -d` |
| ماك (Apple Silicon) — أسرع بكثير | ثبّت [Ollama](https://ollama.com/download) على الجهاز، ثم: `ollama pull qwen2.5:7b && ollama pull bge-m3`، وأضف إلى `.env` السطر `OLLAMA_HOST=http://host.docker.internal:11434`، ثم `docker compose up -d` |

أول تشغيل يحمّل النماذج (عدة غيغابايت). تابع التقدم بـ:

```bash
docker compose --profile cpu logs -f ollama-pull-cpu
```

بعدها افتح http://localhost:5678 وأنشئ حساب المالك (يبقى على جهازك فقط).
ستجد سير عمل جاهزين ومفعّلين، وبيانات الاعتماد (Ollama و Qdrant) مضبوطة تلقائيًا.

## الاستخدام

**١. إضافة مستندات**

- من المتصفح: http://localhost:5678/form/kb-upload ثم ارفع ملفًا أو عدة ملفات.
- دفعة واحدة: ضع الملفات في مجلد `documents/` ثم:

  ```bash
  ./scripts/ingest-folder.sh            # أو: ./scripts/ingest-folder.sh /path/to/folder
  ```

الأنواع المدعومة: PDF, DOCX, TXT, MD, CSV, JSON. (ملفات PDF الممسوحة ضوئيًا
تحتاج OCR أولًا لأنها صور لا نص.)

**٢. طرح الأسئلة**

- افتح سير العمل «قاعدة المعرفة - اسأل (Chat)» واضغط **Open chat**، وستجد
  رابط صفحة المحادثة المستقلة في عقدة «المحادثة».
- أو عبر الـ API:

  ```bash
  curl -X POST http://localhost:5678/webhook/0d6e1f2a-3b4c-4d5e-8f90-a1b2c3d4e5f6/chat \
    -H 'content-type: application/json' \
    -d '{"action":"sendMessage","sessionId":"me","chatInput":"ما مدة تغيير كلمة المرور؟"}'
  ```

## أطر الهيئة الوطنية للأمن السيبراني (جاهزة)

في مجلد `frameworks/` سبعة أطر من NCA (ECC-2024، CCC-2024، CSCC، DCC، OTCC، TCC، OSMACC)
مستخرجة ومرتبة، مع تقرير مقارنة بموقع AutGRC. لتحميلها في قاعدة المعرفة:

```bash
./scripts/ingest-folder.sh frameworks/markdown
```

التفاصيل والتحليل في [`frameworks/README.md`](frameworks/README.md).

## عينات السياسات والنماذج (من جهازك)

العينات مواد مرخّصة أو من أطراف أخرى. لذلك لا تُرفع إلى المستودع: تُحوَّل محلياً إلى `documents/samples/`، وهذا المجلد مستثنى من git، ثم تُرفع إلى قاعدة المعرفة:

```bash
pip install python-docx openpyxl pdfplumber
python3 scripts/convert-samples.py "/path/to/ISO27001-Policies and Procedures and Forms and Templates"
./scripts/ingest-folder.sh documents/samples
```

السكربت يتخطى الملفات الشخصية بحسب الاسم، مثل الفواتير ونتائج الاختبارات والشهادات، ويطبع كل ملف تخطّاه مع السبب.

نتيجة مقارنة العينات بالموقع في [`samples-comparison.md`](samples-comparison.md). ومراجعة ملف الربط بين ISO والهيئة في [`frameworks/iso-nca-mapping.md`](frameworks/iso-nca-mapping.md).

## التخصيص

| ما تريد تغييره | أين |
| --- | --- |
| النماذج أو اسم المجموعة | `.env` ثم `docker compose run --rm n8n-import && docker restart n8n` |
| حجم المقاطع (1000 حرف) والتداخل (150) | عقدة «تقسيم النص» في سير عمل الرفع |
| عدد المقاطع المسترجعة (6) | عقدة `knowledge_base` في سير عمل المحادثة |
| تعليمات المساعد (أسلوب الإجابة، اللغة…) | System Message في عقدة «وكيل قاعدة المعرفة» |

ملاحظة: تغيير `EMBEDDING_MODEL` يغيّر أبعاد المتجهات، فاحذف المجموعة القديمة
(`curl -X DELETE http://localhost:6333/collections/knowledge_base`) وأعد رفع المستندات.

## الصيانة

```bash
docker compose --profile cpu stop          # إيقاف
docker compose --profile cpu up -d         # تشغيل
docker compose --profile cpu pull && docker compose --profile cpu up -d   # تحديث
curl -X DELETE http://localhost:6333/collections/knowledge_base           # مسح كل المستندات
docker compose --profile cpu down -v       # حذف كل شيء (البيانات والنماذج)
```

## الأمان

- كل المنافذ مربوطة على `127.0.0.1`، فلا يصل إليها أحد من الشبكة.
- نموذج الرفع وصفحة المحادثة بلا كلمة مرور لهذا السبب. إن أردت فتحها على
  الشبكة فغيّر `Authentication` في عقدتي «رفع المستندات» و«المحادثة» إلى
  `Basic Auth` أو `n8n User Auth` أولًا.
- لا تفقد `N8N_ENCRYPTION_KEY`: بدونه لا يمكن فك تشفير بيانات الاعتماد المحفوظة.

## الملفات

```
knowledge-base/
├── docker-compose.yml            # n8n + Qdrant + Ollama
├── .env.example
├── workflows/ingest.json         # نموذج رفع → تقسيم → تضمين → Qdrant
├── workflows/chat.json           # محادثة → وكيل AI → بحث في Qdrant
├── credentials/credentials.template.json
├── scripts/import.sh             # يستورد بيانات الاعتماد وسير العمل عند التشغيل
├── scripts/ingest-folder.sh      # رفع مجلد كامل
├── scripts/convert-samples.py    # تحويل العينات إلى Markdown محلياً
├── samples-comparison.md         # مقارنة العينات بالموقع
└── documents/                    # ضع ملفاتك هنا (لا تُرفع إلى Git)
```

</div>
