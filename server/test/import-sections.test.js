/**
 * An imported document keeps its structure and every line of its text, and
 * its numbers are not shown twice once exported.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { segmentImported } from '../src/services/import-sections.js';
import { htmlToBlocks } from '../src/services/html-to-blocks.js';
import { bidiRuns, visualOrder, paragraphDirection } from '../src/services/bidi.js';

// As mammoth reads a customer's Arabic policy: numbered headings, a
// subheading, Word's own list, a typed list, and a title line before it all.
const WORD_HTML = [
  '<p>سياسة إدارة الهويات والصلاحيات</p>',
  '<h1>1. الغرض</h1><p>تهدف هذه السياسة إلى تحديد متطلبات إدارة الهويات.</p>',
  '<h1>2. النطاق</h1><p>تنطبق على جميع الأنظمة.</p>',
  '<h1>3. بنود السياسة</h1>',
  '<h2>3.1 المتطلبات العامة</h2>',
  '<ol><li>يجب تعريف هوية فريدة لكل مستخدم</li><li>يجب تطبيق التحقق متعدد العناصر (MFA) للدخول عن بعد</li><li>يجب مراجعة الصلاحيات كل 3 أشهر</li></ol>',
  '<h2>3.2 الصلاحيات الهامة</h2>',
  '<p>1. يجب تقييد الصلاحيات الهامة.</p><p>2. يجب تسجيل عمليات الدخول ومراقبتها.</p>',
  '<h1>4. الالتزام</h1><p>يجب الالتزام بهذه السياسة.</p>'
].join('');

test('a Word import keeps its sections, subheadings and lists, and loses no text', () => {
  const sections = segmentImported({ html: WORD_HTML, language: 'ar' });
  assert.deepEqual(sections.map((s) => s.heading), ['الغرض', 'النطاق', 'بنود السياسة', 'الالتزام']);
  const items = sections[2].body;
  // Every list item survives, the one with an English abbreviation included.
  for (const text of ['يجب تعريف هوية فريدة لكل مستخدم', '(MFA)', 'كل 3 أشهر', 'يجب تقييد الصلاحيات الهامة', 'يجب تسجيل عمليات الدخول']) {
    assert.ok(items.includes(text), `missing: ${text}`);
  }
  assert.match(items, /<h3><span class="clause-ref">3\.1<\/span> المتطلبات العامة<\/h3>/);
  // The typed "1." "2." became a numbered list without the typed numbers.
  assert.match(items, /<ol><li>يجب تقييد الصلاحيات الهامة\.<\/li><li>يجب تسجيل/);
  assert.doesNotMatch(items, /<li>1\./);
});

test('a text import does not take an Arabic line with an abbreviation for a heading', () => {
  const text = [
    '1. الغرض', 'تهدف هذه السياسة إلى تحديد متطلبات إدارة الهويات والصلاحيات في الشركة.',
    '2. المتطلبات', 'يجب تطبيق التحقق متعدد العناصر (MFA) للدخول عن بعد', 'يجب مراجعة الصلاحيات كل 3 أشهر'
  ].join('\n');
  const sections = segmentImported({ text, language: 'ar' });
  assert.deepEqual(sections.map((s) => s.heading), ['الغرض', 'المتطلبات']);
  assert.ok(sections[1].body.includes('(MFA)') && sections[1].body.includes('كل 3 أشهر'));
});

test('a table of contents is not read as a row of headings', () => {
  const text = ['1. Purpose', '2. Scope', '3. Policy', 'Purpose', 'This policy sets out the requirements for access control.', 'Scope', 'It applies to every system the organisation runs.'].join('\n');
  const sections = segmentImported({ text });
  assert.deepEqual(sections.map((s) => s.heading), ['Purpose', 'Scope']);
});

test('a numbered list whose items carry their own numbers is not numbered again', () => {
  const [typed, plain] = htmlToBlocks('<ol><li>1. a</li><li>2. b</li></ol><ol><li>x</li><li>y</li></ol>');
  assert.equal(typed.ordered, false);
  assert.equal(typed.plain, true);
  assert.equal(plain.ordered, true);
});

test('a left-to-right line with Arabic in it is ordered as a reader reads it', () => {
  const order = (s, base) => visualOrder(bidiRuns(s, base)).map((r) => r.text.trim()).filter(Boolean);
  assert.deepEqual(order('Najd Group | سياسة 3 Group', 'ltr'), ['Najd Group |', '3', 'سياسة', 'Group']);
  // In an Arabic line the runs read from the right: drawn from the left, reversed.
  assert.deepEqual(order('POL-IAM-004 · الإصدار 0.1', 'rtl'), ['0.1', '· الإصدار', 'POL-IAM-004']);
});

test('a mostly Arabic sentence that opens with an English command reads right to left', () => {
  assert.equal(paragraphDirection('Get-ADGroupMember للمجموعات ذات الصلاحيات مقارنةً بالقائمة المعتمدة.'), 'rtl');
  assert.equal(paragraphDirection('The policy is reviewed annually (4.2.1).'), 'ltr');
  assert.equal(paragraphDirection('2024 — 12'), 'rtl');
});

test('an Arabic policy is read as the domain its title names, not one its body mentions', async () => {
  const { detectDomain } = await import('../src/services/import.js');
  const text = 'سياسة إدارة الهويات والصلاحيات\n1. الغرض\nتهدف هذه السياسة إلى تحديد متطلبات الأمن السيبراني المتعلقة بإدارة هويات الدخول والصلاحيات.\n2. النطاق\nتنطبق على جميع الأنظمة والتطبيقات وقواعد البيانات المملوكة للشركة.';
  assert.equal(detectDomain(text).best.key, 'iam');
});
