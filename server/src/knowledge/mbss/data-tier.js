/**
 * Minimum Baseline Security Standards: databases and web servers.
 * See systems.js for how items are written.
 */

import { c, o } from './items.js';

/** What every database baseline ends with: placement and backup. */
const dbCommon = [
  o('network', 1,
    'The database host accepts connections only from the application tier and the administration network.',
    'لا يقبل خادم قاعدة البيانات الاتصال إلا من طبقة التطبيقات وشبكة الإدارة.',
    'Host and network firewall rules for the listener port.',
    'قواعد الجدار الناري للمضيف والشبكة على منفذ الاستماع.'),
  o('data', 1,
    'Backups are encrypted, held away from the database host, and a restore is tested.',
    'النسخ الاحتياطية مشفّرة ومحفوظة بعيداً عن خادم قاعدة البيانات، مع اختبار الاستعادة.',
    'Backup configuration and the last restore test record.',
    'إعداد النسخ الاحتياطي وآخر اختبار استعادة.')
];

const oracle = {
  key: 'oracle_db', prefix: 'DOR', category: 'database', domain: 'database_security',
  name: 'Oracle Database', nameAr: 'Oracle Database',
  benchmark: 'CIS Oracle Database Benchmark (19c, 23ai)',
  aliases: ['oracle database', 'oracle db', 'oracle'],
  items: [
    c('patching', 1,
      'The latest Release Update is applied within {{patchDeploymentSla}}.',
      'تطبيق آخر Release Update خلال {{patchDeploymentSla}}.',
      'opatch lspatches; the registry of applied patches.',
      'opatch lspatches، وسجل التصحيحات المطبقة.'),
    c('accounts', 1,
      'Default and sample accounts are locked and expired, and none keeps a default password.',
      'الحسابات الافتراضية والتجريبية مقفلة ومنتهية، ولا يحمل أي منها كلمة مرور افتراضية.',
      'SELECT * FROM DBA_USERS_WITH_DEFPWD; account_status in DBA_USERS.',
      'استعلام DBA_USERS_WITH_DEFPWD وحالة الحسابات في DBA_USERS.'),
    c('accounts', 1,
      'Profiles set FAILED_LOGIN_ATTEMPTS to {{accountLockoutThreshold}} and use a password verify function.',
      'تضبط الملفات الشخصية FAILED_LOGIN_ATTEMPTS على {{accountLockoutThreshold}} وتستخدم دالة تحقق من كلمة المرور.',
      'SELECT * FROM DBA_PROFILES.',
      'استعلام DBA_PROFILES.'),
    c('accounts', 1,
      'No execute grant to PUBLIC on network and file packages (UTL_FILE, UTL_TCP, UTL_HTTP, UTL_SMTP, DBMS_JAVA); the DBA role is held only by named administrators.',
      'لا منح تنفيذ لـ PUBLIC على حزم الشبكة والملفات (UTL_FILE وUTL_TCP وUTL_HTTP وUTL_SMTP وDBMS_JAVA)، ولا يحمل دور DBA إلا مسؤولون مسمّون.',
      'DBA_TAB_PRIVS where grantee = PUBLIC; DBA_ROLE_PRIVS for DBA.',
      'DBA_TAB_PRIVS للمستفيد PUBLIC، وDBA_ROLE_PRIVS لدور DBA.'),
    c('services', 1,
      'Initialisation parameters: AUDIT_SYS_OPERATIONS TRUE, O7_DICTIONARY_ACCESSIBILITY FALSE, SQL92_SECURITY TRUE, REMOTE_OS_AUTHENT FALSE where present.',
      'معاملات التهيئة: AUDIT_SYS_OPERATIONS = TRUE، وO7_DICTIONARY_ACCESSIBILITY = FALSE، وSQL92_SECURITY = TRUE، وREMOTE_OS_AUTHENT = FALSE حيث وُجد.',
      'SELECT name, value FROM V$PARAMETER for each parameter.',
      'استعلام V$PARAMETER لكل معامل.'),
    c('network', 1,
      'The listener is protected: ADMIN_RESTRICTIONS on, and valid node checking limits clients.',
      'حماية المستمع: تفعيل ADMIN_RESTRICTIONS، وتقييد العملاء بالتحقق من العقد الصالحة.',
      'listener.ora and sqlnet.ora.',
      'listener.ora وsqlnet.ora.'),
    c('logging', 1,
      'Unified auditing records logons, privileged actions and schema changes; the audit trail is protected and forwarded to the SIEM.',
      'يسجّل التدقيق الموحد عمليات الدخول والإجراءات ذات الصلاحيات وتغييرات المخطط، مع حماية سجل التدقيق وإرساله إلى نظام SIEM.',
      'AUDIT_UNIFIED_ENABLED_POLICIES; SIEM collection.',
      'AUDIT_UNIFIED_ENABLED_POLICIES، والجمع في نظام SIEM.'),
    c('crypto', 1,
      'Client connections are encrypted (native network encryption or TLS).',
      'تشفير اتصالات العملاء (التشفير الأصلي للشبكة أو TLS).',
      'sqlnet.ora SQLNET.ENCRYPTION_SERVER REQUIRED, or TCPS listener.',
      'إعداد SQLNET.ENCRYPTION_SERVER = REQUIRED في sqlnet.ora أو مستمع TCPS.'),
    o('crypto', 2,
      'Tablespaces holding Confidential data use Transparent Data Encryption.',
      'تستخدم مساحات الجداول التي تحوي بيانات سرية التشفير الشفاف للبيانات (TDE).',
      'V$ENCRYPTED_TABLESPACES.',
      'V$ENCRYPTED_TABLESPACES.'),
    ...dbCommon
  ]
};

const mssql = {
  key: 'mssql', prefix: 'DMS', category: 'database', domain: 'database_security',
  name: 'Microsoft SQL Server', nameAr: 'Microsoft SQL Server',
  benchmark: 'CIS Microsoft SQL Server Benchmark (2019, 2022)',
  aliases: ['sql server', 'mssql', 'microsoft sql'],
  items: [
    c('patching', 1,
      'The latest cumulative update is applied within {{patchDeploymentSla}}.',
      'تطبيق آخر تحديث تراكمي خلال {{patchDeploymentSla}}.',
      'SELECT @@VERSION against the vendor release list.',
      'SELECT @@VERSION مقارنةً بقائمة إصدارات المورّد.'),
    c('accounts', 1,
      'Windows authentication is used; where mixed mode is required, the sa login is disabled and renamed and SQL logins enforce the password policy and expiry.',
      'يُستخدم تحقق Windows، وحيث يلزم الوضع المختلط يُعطَّل حساب sa ويُعاد تسميته، وتفرض حسابات SQL سياسة كلمات المرور وانتهاءها.',
      'SERVERPROPERTY(\'IsIntegratedSecurityOnly\'); sys.sql_logins is_policy_checked, is_expiration_checked.',
      'SERVERPROPERTY لوضع التحقق، وsys.sql_logins لفرض السياسة.'),
    c('services', 1,
      'xp_cmdshell, Ad Hoc Distributed Queries, OLE Automation Procedures, remote access and Database Mail XPs are disabled unless approved.',
      'تعطيل xp_cmdshell وAd Hoc Distributed Queries وOLE Automation Procedures وremote access وDatabase Mail XPs ما لم تُعتمد.',
      'SELECT name, value_in_use FROM sys.configurations.',
      'استعلام sys.configurations.'),
    c('accounts', 1,
      'The guest user has no CONNECT permission in user databases, and the public role holds no extra permissions.',
      'لا يملك المستخدم guest صلاحية CONNECT في قواعد بيانات المستخدمين، ولا يحمل دور public صلاحيات إضافية.',
      'sys.database_permissions per database; sys.server_permissions for public.',
      'sys.database_permissions لكل قاعدة، وsys.server_permissions لدور public.'),
    c('accounts', 1,
      'Each SQL Server service runs under its own non-administrative account.',
      'تعمل كل خدمة من خدمات SQL Server بحساب مستقل غير إداري.',
      'SQL Server Configuration Manager; local Administrators group.',
      'SQL Server Configuration Manager، ومجموعة المسؤولين المحليين.'),
    c('logging', 1,
      'Failed and successful logins are audited, and a SQL Server Audit covers privileged changes; audit records reach the SIEM.',
      'تدقيق عمليات الدخول الفاشلة والناجحة، وتغطي SQL Server Audit التغييرات ذات الصلاحيات، وتصل السجلات إلى نظام SIEM.',
      'Server properties login auditing; sys.server_audits and specifications.',
      'خصائص تدقيق الدخول، وsys.server_audits.'),
    c('crypto', 1,
      'Connections are forced to encrypt with TLS 1.2 or later.',
      'فرض تشفير الاتصالات بـ TLS 1.2 فأحدث.',
      'Configuration Manager "Force Encryption"; SCHANNEL settings.',
      'خيار Force Encryption وإعدادات SCHANNEL.'),
    c('services', 1,
      'The SQL Server Browser service is disabled unless named instances require it.',
      'تعطيل خدمة SQL Server Browser ما لم تحتجها النسخ المسمّاة.',
      'Get-Service SQLBrowser.',
      'Get-Service SQLBrowser.'),
    o('crypto', 2,
      'Databases holding Confidential data use Transparent Data Encryption.',
      'تستخدم قواعد البيانات التي تحوي بيانات سرية التشفير الشفاف (TDE).',
      'sys.dm_database_encryption_keys.',
      'sys.dm_database_encryption_keys.'),
    ...dbCommon
  ]
};

const postgres = {
  key: 'postgresql', prefix: 'DPG', category: 'database', domain: 'database_security',
  name: 'PostgreSQL', nameAr: 'PostgreSQL',
  benchmark: 'CIS PostgreSQL Benchmark',
  aliases: ['postgresql', 'postgres'],
  items: [
    c('patching', 1,
      'A supported minor release is installed within {{patchDeploymentSla}} of publication.',
      'تثبيت إصدار فرعي مدعوم خلال {{patchDeploymentSla}} من نشره.',
      'SELECT version(); against the project release list.',
      'SELECT version() مقارنةً بقائمة الإصدارات.'),
    c('accounts', 1,
      'pg_hba.conf uses scram-sha-256 and lists only the hosts that need access; no entry uses trust.',
      'يستخدم pg_hba.conf طريقة scram-sha-256 ولا يذكر إلا المضيفين المحتاجين، ولا يستخدم أي إدخال trust.',
      'pg_hba.conf; SELECT * FROM pg_hba_file_rules.',
      'pg_hba.conf، واستعلام pg_hba_file_rules.'),
    c('crypto', 1,
      'password_encryption is scram-sha-256; ssl is on with ssl_min_protocol_version TLSv1.2.',
      'ضبط password_encryption على scram-sha-256، وتفعيل ssl مع ssl_min_protocol_version = TLSv1.2.',
      'SHOW password_encryption; SHOW ssl; SHOW ssl_min_protocol_version.',
      'أوامر SHOW للمعاملات المذكورة.'),
    c('logging', 1,
      'Connections, disconnections and DDL are logged with a prefix naming user, database and client; pgAudit covers privileged activity; logs reach the SIEM.',
      'تسجيل الاتصالات والانفصالات وأوامر DDL مع بادئة تذكر المستخدم وقاعدة البيانات والعميل، وتغطية pgAudit للنشاط ذي الصلاحيات، ووصول السجلات إلى نظام SIEM.',
      'SHOW log_connections, log_disconnections, log_statement, log_line_prefix; pgaudit.log.',
      'أوامر SHOW لإعدادات السجلات وpgaudit.log.'),
    c('accounts', 1,
      'Only database administrators hold superuser; application roles hold the privileges they need, and CREATE on the public schema is revoked.',
      'لا يحمل صلاحية superuser إلا مسؤولو قواعد البيانات، وتحمل أدوار التطبيقات ما تحتاجه فقط، ويُسحب CREATE على المخطط public.',
      'SELECT rolname FROM pg_roles WHERE rolsuper; \\dn+ public.',
      'استعلام pg_roles للأدوار الخارقة، وصلاحيات المخطط public.'),
    c('network', 1,
      'listen_addresses names only the interfaces in use.',
      'لا يذكر listen_addresses إلا الواجهات المستخدمة.',
      'SHOW listen_addresses.',
      'SHOW listen_addresses.'),
    c('services', 1,
      'The data directory belongs to the postgres user with permissions 0700.',
      'مجلد البيانات مملوك لمستخدم postgres بصلاحيات 0700.',
      'stat on PGDATA.',
      'stat على مجلد PGDATA.'),
    ...dbCommon
  ]
};

const mysql = {
  key: 'mysql', prefix: 'DMY', category: 'database', domain: 'database_security',
  name: 'MySQL and MariaDB', nameAr: 'MySQL وMariaDB',
  benchmark: 'CIS Oracle MySQL Enterprise / Community Benchmark; CIS MariaDB Benchmark',
  aliases: ['mysql', 'mariadb'],
  items: [
    c('patching', 1,
      'A supported release is installed and security fixes applied within {{patchDeploymentSla}}.',
      'تثبيت إصدار مدعوم وتطبيق الإصلاحات الأمنية خلال {{patchDeploymentSla}}.',
      'SELECT VERSION(); against the vendor release list.',
      'SELECT VERSION() مقارنةً بقائمة الإصدارات.'),
    c('accounts', 1,
      'Anonymous accounts and the test database are removed; root cannot log in remotely.',
      'إزالة الحسابات المجهولة وقاعدة test، ومنع دخول root عن بُعد.',
      'SELECT user, host FROM mysql.user; SHOW DATABASES.',
      'استعلام mysql.user، وSHOW DATABASES.'),
    c('accounts', 1,
      'The password validation component enforces {{passwordMinLength}}.',
      'يفرض مكون التحقق من كلمات المرور {{passwordMinLength}}.',
      'SHOW VARIABLES LIKE \'validate_password%\'.',
      'SHOW VARIABLES LIKE validate_password.'),
    c('crypto', 1,
      'require_secure_transport is ON and only TLS 1.2 or later is accepted.',
      'تفعيل require_secure_transport وقبول TLS 1.2 فأحدث فقط.',
      'SHOW VARIABLES LIKE \'require_secure_transport\'; tls_version.',
      'SHOW VARIABLES للمتغيرين.'),
    c('services', 1,
      'local_infile is 0 and secure_file_priv names a dedicated directory.',
      'ضبط local_infile على 0، وsecure_file_priv على مجلد مخصص.',
      'SHOW VARIABLES LIKE \'local_infile\'; secure_file_priv.',
      'SHOW VARIABLES للمتغيرين.'),
    c('accounts', 1,
      'Application accounts hold no global privileges; SUPER and FILE are held only by administrators.',
      'لا تحمل حسابات التطبيقات صلاحيات عامة، ولا يحمل SUPER وFILE إلا المسؤولون.',
      'SELECT * FROM mysql.user for global privileges; SHOW GRANTS.',
      'استعلام الصلاحيات العامة، وSHOW GRANTS.'),
    c('logging', 1,
      'The error log is on and an audit log records logins and privileged statements; logs reach the SIEM.',
      'تفعيل سجل الأخطاء وسجل تدقيق يسجّل عمليات الدخول والأوامر ذات الصلاحيات، ووصول السجلات إلى نظام SIEM.',
      'SHOW VARIABLES LIKE \'log_error\'; audit plugin or component status.',
      'متغير log_error، وحالة مكون التدقيق.'),
    ...dbCommon
  ]
};

/** What every web server baseline shares, in the server's own directives. */
function webItems(w) {
  return [
    c('services', 1,
      `The server runs as a dedicated non-privileged account (${w.user}).`,
      `يعمل الخادم بحساب مخصص غير ذي صلاحيات (${w.user}).`,
      w.userCheck, w.userCheck),
    c('services', 1,
      `Directory listing is off (${w.listing}) and default and sample content is removed.`,
      `إيقاف عرض محتوى المجلدات (${w.listing})، وإزالة المحتوى الافتراضي والتجريبي.`,
      w.listingCheck, w.listingCheck),
    c('services', 1,
      `Modules and features not needed are disabled (${w.modules}).`,
      `تعطيل الوحدات والميزات غير اللازمة (${w.modules}).`,
      w.modulesCheck, w.modulesCheck),
    c('services', 1,
      `The server does not disclose its version or technology (${w.banner}); detailed errors are not returned to clients.`,
      `لا يكشف الخادم إصداره أو تقنيته (${w.banner})، ولا تُعاد رسائل الخطأ التفصيلية للعملاء.`,
      w.bannerCheck, w.bannerCheck),
    c('services', 1,
      `The TRACE method is disabled and request size and timeouts are limited (${w.limits}).`,
      `تعطيل طريقة TRACE وتقييد حجم الطلبات ومهلها (${w.limits}).`,
      w.limitsCheck, w.limitsCheck),
    c('crypto', 1,
      'Only TLS 1.2 and 1.3 with strong ciphers are accepted; HTTP redirects to HTTPS and HSTS is sent.',
      'لا يُقبل إلا TLS 1.2 و1.3 مع خوارزميات قوية، ويُعاد توجيه HTTP إلى HTTPS، ويُرسل ترويسة HSTS.',
      w.tlsCheck, w.tlsCheck),
    o('services', 1,
      'Security headers are sent: Content-Security-Policy, X-Content-Type-Options nosniff and frame protection.',
      'إرسال ترويسات الأمان: Content-Security-Policy وX-Content-Type-Options = nosniff والحماية من التضمين.',
      'Response headers of the site (curl -I).',
      'ترويسات استجابة الموقع (curl -I).'),
    c('logging', 1,
      'Access and error logs record client address, time, request, status and user agent, and are forwarded to the SIEM.',
      'تسجّل سجلات الوصول والأخطاء عنوان العميل والوقت والطلب والحالة ووكيل المستخدم، وتُرسل إلى نظام SIEM.',
      w.logCheck, w.logCheck),
    c('patching', 1,
      'The server and its modules are on a supported release, updated within {{patchDeploymentSla}}.',
      'الخادم ووحداته على إصدار مدعوم ومحدّث خلال {{patchDeploymentSla}}.',
      w.versionCheck, w.versionCheck)
  ];
}

const iis = {
  key: 'iis', prefix: 'WIS', category: 'web', domain: 'application_security',
  name: 'Microsoft IIS', nameAr: 'Microsoft IIS',
  benchmark: 'CIS Microsoft IIS 10 Benchmark',
  aliases: ['iis', 'internet information services'],
  items: webItems({
    user: 'a unique ApplicationPoolIdentity for each application pool', userCheck: 'IIS Manager > Application Pools > Identity',
    listing: 'directoryBrowse enabled="false"', listingCheck: 'appcmd list config /section:directoryBrowse; site content',
    modules: 'WebDAV, CGI and unused handlers', modulesCheck: 'Get-WindowsFeature Web-*; handler mappings',
    banner: 'X-Powered-By and the Server header removed', bannerCheck: 'Response headers; httpErrors errorMode="DetailedLocalOnly" or Custom',
    limits: 'requestFiltering limits, allowDoubleEscaping false', limitsCheck: 'appcmd list config /section:requestFiltering',
    tlsCheck: 'SCHANNEL protocol and cipher keys; site bindings',
    logCheck: 'IIS logging fields (W3C) and log forwarding', versionCheck: 'Windows update report for the server'
  })
};

const apache = {
  key: 'apache', prefix: 'WAP', category: 'web', domain: 'application_security',
  name: 'Apache HTTP Server', nameAr: 'Apache HTTP Server',
  benchmark: 'CIS Apache HTTP Server 2.4 Benchmark',
  aliases: ['apache', 'httpd'],
  items: webItems({
    user: 'User and Group directives naming a dedicated account', userCheck: 'httpd -S; ps -o user -C httpd',
    listing: 'Options -Indexes, AllowOverride None', listingCheck: 'httpd.conf and included files',
    modules: 'autoindex, userdir, dav, status and info unless restricted', modulesCheck: 'httpd -M',
    banner: 'ServerTokens Prod, ServerSignature Off', bannerCheck: 'httpd.conf; response headers',
    limits: 'TraceEnable off, Timeout 10, LimitRequestBody and LimitRequestFields', limitsCheck: 'httpd.conf',
    tlsCheck: 'SSLProtocol and SSLCipherSuite in ssl.conf',
    logCheck: 'LogFormat and CustomLog; log forwarding', versionCheck: 'httpd -v against the vendor release list'
  })
};

const nginx = {
  key: 'nginx', prefix: 'WNG', category: 'web', domain: 'application_security',
  name: 'NGINX', nameAr: 'NGINX',
  benchmark: 'CIS NGINX Benchmark',
  aliases: ['nginx'],
  items: webItems({
    user: 'the user directive naming a dedicated account', userCheck: 'nginx -T | grep user; ps -o user -C nginx',
    listing: 'autoindex off', listingCheck: 'nginx -T | grep autoindex; default server block',
    modules: 'modules not used by the configuration', modulesCheck: 'nginx -V; load_module directives',
    banner: 'server_tokens off', bannerCheck: 'nginx -T | grep server_tokens; response headers',
    limits: 'client_body_timeout and client_header_timeout 10, client_max_body_size limited', limitsCheck: 'nginx -T',
    tlsCheck: 'ssl_protocols and ssl_ciphers in nginx -T',
    logCheck: 'access_log and error_log directives; log forwarding', versionCheck: 'nginx -v against the vendor release list'
  })
};

export const DATA_TIER = [oracle, mssql, postgres, mysql, iis, apache, nginx];
