/**
 * Minimum Baseline Security Standards: network and security devices.
 * See systems.js for how items are written.
 */

import { c, o } from './items.js';

const ciscoIos = {
  key: 'cisco_ios', prefix: 'NCI', category: 'network', domain: 'network_security',
  name: 'Cisco IOS / IOS XE routers and switches', nameAr: 'موجهات ومبدلات Cisco IOS / IOS XE',
  benchmark: 'CIS Cisco IOS XE Benchmark',
  aliases: ['cisco', 'router', 'switch'],
  items: [
    c('accounts', 1,
      'Administrative access is authenticated through AAA (TACACS+ or RADIUS); the local account is kept for emergency use only.',
      'يتم التحقق من الوصول الإداري عبر AAA (TACACS+ أو RADIUS)، ويُبقى الحساب المحلي للطوارئ فقط.',
      'show running-config | include aaa.',
      'show running-config | include aaa.'),
    c('accounts', 1,
      'The enable secret uses a strong hash (type 8 or 9) and service password-encryption is on.',
      'كلمة enable secret بتجزئة قوية (النوع 8 أو 9)، مع تفعيل service password-encryption.',
      'show running-config | include enable secret|service password.',
      'show running-config | include enable secret|service password.'),
    c('network', 1,
      'Management is over SSH version 2 only; Telnet and the HTTP server are disabled.',
      'تتم الإدارة عبر SSH الإصدار 2 فقط، مع تعطيل Telnet وخادم HTTP.',
      'show ip ssh; show running-config | include transport input|ip http.',
      'show ip ssh، وإعدادات transport input وip http.'),
    c('network', 1,
      'VTY lines accept connections only from the management network (access-class) and time out after {{sessionIdleTimeout}}.',
      'لا تقبل خطوط VTY الاتصال إلا من شبكة الإدارة (access-class)، وتنتهي الجلسة بعد {{sessionIdleTimeout}}.',
      'show running-config | section line vty.',
      'show running-config | section line vty.'),
    c('services', 1,
      'A login banner is configured.',
      'ضبط شعار قبل تسجيل الدخول.',
      'show running-config | include banner.',
      'show running-config | include banner.'),
    c('services', 1,
      'Unneeded services are off: CDP on external interfaces, IP source routing, BOOTP, small servers and finger.',
      'إيقاف الخدمات غير اللازمة: CDP على الواجهات الخارجية، وتوجيه المصدر، وBOOTP، والخوادم الصغيرة، وfinger.',
      'show running-config for each service; show cdp interface.',
      'show running-config لكل خدمة، وshow cdp interface.'),
    c('network', 1,
      'SNMP uses version 3 with authentication and privacy; no default community strings exist.',
      'استخدام SNMP الإصدار 3 بالتحقق والتشفير، ولا توجد سلاسل مجتمع افتراضية.',
      'show snmp user; show running-config | include snmp-server community.',
      'show snmp user، والتحقق من عدم وجود community.'),
    c('logging', 1,
      'Logs with timestamps go to the central syslog server; time is synchronised with {{timeSyncSource}} using NTP authentication.',
      'تُرسل السجلات مع الطوابع الزمنية إلى خادم syslog المركزي، ويُزامَن الوقت مع {{timeSyncSource}} عبر NTP بالتحقق.',
      'show logging; show ntp associations; show running-config | include ntp authenticate.',
      'show logging، وshow ntp associations، وإعداد التحقق في NTP.'),
    c('network', 2,
      'Routing protocols authenticate their neighbours.',
      'تتحقق بروتوكولات التوجيه من الجيران.',
      'Routing protocol configuration (authentication key chains).',
      'إعداد بروتوكولات التوجيه (سلاسل مفاتيح التحقق).'),
    o('network', 1,
      'Unused interfaces are shut down and placed in an unused VLAN; access ports use port security and DHCP snooping.',
      'إغلاق الواجهات غير المستخدمة ووضعها في VLAN غير مستخدمة، وتفعيل أمن المنافذ وDHCP snooping على منافذ الوصول.',
      'show interfaces status; show port-security; show ip dhcp snooping.',
      'show interfaces status، وshow port-security، وshow ip dhcp snooping.'),
    o('data', 1,
      'The configuration is backed up after every change and compared with the approved baseline.',
      'نسخ الإعداد احتياطياً بعد كل تغيير ومقارنته بخط الأساس المعتمد.',
      'Configuration management tool history.',
      'سجل أداة إدارة الإعدادات.'),
    c('patching', 1,
      'The software version is supported and security advisories are applied within {{criticalRemediationSla}} for critical issues.',
      'الإصدار مدعوم، وتُطبّق الإرشادات الأمنية الحرجة خلال {{criticalRemediationSla}}.',
      'show version against the vendor advisory list.',
      'show version مقارنةً بقائمة إرشادات المورّد.')
  ]
};

/** Firewall items shared by the vendors, each stated in the vendor's own terms. */
function firewallItems(v) {
  return [
    c('network', 1,
      `The management interface is on a dedicated management network and accepts connections only from ${v.permitted}.`,
      `واجهة الإدارة على شبكة إدارة مخصصة، ولا تقبل الاتصال إلا من ${v.permittedAr}.`,
      v.mgmtCheck, v.mgmtCheck),
    c('accounts', 1,
      'Administrators authenticate through RADIUS, TACACS+ or SAML with MFA; the local administrator is for emergency use, renamed or with a changed default password.',
      'يتحقق المسؤولون عبر RADIUS أو TACACS+ أو SAML مع التحقق متعدد العوامل، والحساب المحلي للطوارئ، بعد تغيير اسمه أو كلمة مروره الافتراضية.',
      v.authCheck, v.authCheck),
    c('accounts', 1,
      'Administrator accounts lock after {{accountLockoutThreshold}} and sessions end after {{sessionIdleTimeout}} idle.',
      'تُقفَل حسابات المسؤولين بعد {{accountLockoutThreshold}}، وتنتهي الجلسة بعد {{sessionIdleTimeout}} من الخمول.',
      v.lockCheck, v.lockCheck),
    c('network', 1,
      'HTTP and Telnet are disabled on every interface; administration is over HTTPS and SSH.',
      'تعطيل HTTP وTelnet على كل الواجهات، والإدارة عبر HTTPS وSSH.',
      v.protoCheck, v.protoCheck),
    c('services', 1,
      'No rule allows any source to any destination on any service; every allow rule logs at session end and applies the threat prevention profiles.',
      'لا قاعدة تسمح من أي مصدر إلى أي وجهة على أي خدمة، وكل قاعدة سماح تسجّل عند نهاية الجلسة وتطبّق ملفات منع التهديدات.',
      v.ruleCheck, v.ruleCheck),
    c('protection', 1,
      'Threat, antivirus and URL databases update automatically at least daily.',
      'تُحدَّث قواعد التهديدات ومكافحة الفيروسات وتصنيف الروابط آلياً يومياً على الأقل.',
      v.updateCheck, v.updateCheck),
    c('crypto', 1,
      'Management and decryption services accept TLS 1.2 or later with strong ciphers only.',
      'لا تقبل خدمات الإدارة وفك التشفير إلا TLS 1.2 فأحدث مع خوارزميات قوية.',
      v.tlsCheck, v.tlsCheck),
    c('logging', 1,
      'Logs go to the SIEM and are kept {{logRetention}}; NTP is synchronised with {{timeSyncSource}}.',
      'تُرسل السجلات إلى نظام SIEM ويُحتفظ بها {{logRetention}}، ويُزامَن الوقت مع {{timeSyncSource}}.',
      v.logCheck, v.logCheck),
    c('network', 1,
      'Internet-facing zones have flood and reconnaissance protection enabled.',
      'تفعيل الحماية من الإغراق والاستطلاع على المناطق المواجهة للإنترنت.',
      v.zoneCheck, v.zoneCheck),
    o('data', 1,
      'The configuration is backed up on a schedule and every change carries a description and an approved change reference.',
      'نسخ الإعداد احتياطياً وفق جدول، ولكل تغيير وصف ورقم تغيير معتمد.',
      'Backup schedule and the change log.',
      'جدول النسخ الاحتياطي وسجل التغييرات.'),
    c('patching', 1,
      'The firmware is supported and critical advisories are applied within {{criticalRemediationSla}}.',
      'البرنامج الثابت مدعوم، وتُطبّق الإرشادات الحرجة خلال {{criticalRemediationSla}}.',
      v.versionCheck, v.versionCheck)
  ];
}

const paloAlto = {
  key: 'palo_alto', prefix: 'NPA', category: 'network', domain: 'network_security',
  name: 'Palo Alto Networks firewalls (PAN-OS)', nameAr: 'جدران حماية Palo Alto Networks (PAN-OS)',
  benchmark: 'CIS Palo Alto Firewall Benchmark',
  aliases: ['palo alto', 'pan-os', 'panorama'],
  items: firewallItems({
    permitted: 'the permitted IP addresses set on the management interface', permittedAr: 'عناوين IP المسموح بها في واجهة الإدارة',
    mgmtCheck: 'Device > Setup > Interfaces > Management: Permitted IP Addresses',
    authCheck: 'Device > Authentication Profile; Device > Administrators',
    lockCheck: 'Authentication profile lockout; Device > Setup > Management idle timeout',
    protoCheck: 'Network > Network Profiles > Interface Mgmt; management interface services',
    ruleCheck: 'Policies > Security: log at session end and a profile group on every allow rule',
    updateCheck: 'Device > Dynamic Updates schedules',
    tlsCheck: 'Device > Certificate Management > SSL/TLS Service Profile (minimum TLSv1.2)',
    logCheck: 'Device > Server Profiles > Syslog; log forwarding profiles; NTP settings',
    zoneCheck: 'Network > Zones > Zone Protection Profile on untrusted zones',
    versionCheck: 'Device > Software against the vendor advisory list'
  })
};

const fortigate = {
  key: 'fortigate', prefix: 'NFG', category: 'network', domain: 'network_security',
  name: 'Fortinet FortiGate firewalls', nameAr: 'جدران حماية Fortinet FortiGate',
  benchmark: 'CIS Fortinet FortiGate Benchmark',
  aliases: ['fortinet', 'fortigate', 'fortios'],
  items: firewallItems({
    permitted: 'the trusted hosts set on each administrator', permittedAr: 'المضيفين الموثوقين المحددين لكل مسؤول',
    mgmtCheck: 'config system admin: trusthost entries; config system interface: allowaccess',
    authCheck: 'config user radius / tacacs+ / saml; config system admin',
    lockCheck: 'config system global: admin-lockout-threshold, admintimeout',
    protoCheck: 'config system interface: allowaccess excludes http and telnet',
    ruleCheck: 'config firewall policy: logtraffic all and UTM profiles on allow policies',
    updateCheck: 'config system autoupdate schedule',
    tlsCheck: 'config system global: admin-https-ssl-versions tlsv1-2 tlsv1-3; strong-crypto enable',
    logCheck: 'config log syslogd setting / fortianalyzer setting; config system ntp',
    zoneCheck: 'DoS policies on internet-facing interfaces',
    versionCheck: 'get system status against the vendor advisory list'
  })
};

const genericFirewall = {
  key: 'firewall_generic', prefix: 'NFW', category: 'network', domain: 'network_security',
  name: 'Other firewalls (Check Point, Cisco ASA / FTD, Sophos …)', nameAr: 'جدران حماية أخرى (Check Point وCisco ASA / FTD وSophos …)',
  benchmark: 'CIS Check Point Firewall Benchmark; CIS Cisco Firewall Benchmark; vendor hardening guide',
  aliases: ['check point', 'checkpoint', 'cisco asa', 'firepower', 'sophos'],
  items: firewallItems({
    permitted: 'the approved management addresses', permittedAr: 'عناوين الإدارة المعتمدة',
    mgmtCheck: 'Management access configuration of the product',
    authCheck: 'Administrator authentication configuration',
    lockCheck: 'Administrator lockout and idle timeout settings',
    protoCheck: 'Management services enabled per interface',
    ruleCheck: 'Rule base review export',
    updateCheck: 'Signature update schedule',
    tlsCheck: 'TLS settings of management and inspection services',
    logCheck: 'Log server and NTP configuration',
    zoneCheck: 'DoS and flood protection settings',
    versionCheck: 'Software version against the vendor advisory list'
  })
};

export const NETWORK = [ciscoIos, paloAlto, fortigate, genericFirewall];
