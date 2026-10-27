/**
 * Platform guide — English. Same pages, in the same order and with the same
 * slugs, as ar.js; see that file for the block types.
 */

export default {
  title: 'Platform guide',
  intro: 'Everything you need to use the platform: first-time setup, generating and approving documents, and managing controls, risks and assurance.',
  groups: [
    { key: 'start', title: 'Getting started' },
    { key: 'documents', title: 'Documents' },
    { key: 'controls', title: 'Controls and compliance' },
    { key: 'risk', title: 'Risk and assurance' },
    { key: 'admin', title: 'Administration' },
    { key: 'reference', title: 'Reference' }
  ],
  pages: [
    {
      slug: 'overview', group: 'start', title: 'Platform overview',
      summary: 'What the platform does, and how its parts fit together.',
      blocks: [
        { p: 'A cybersecurity governance and compliance platform. It generates governance documents from a knowledge base built on the NCA Essential Cybersecurity Controls (ECC-2:2024) and the other NCA control sets, the SAMA Cyber Security Framework, ISO/IEC 27001 and 22301, NIST and others, then follows each document through review, approval, publication and audit.' },
        { h: 'One model per domain' },
        { p: 'Each of the twenty-nine cybersecurity domains has a single requirement model. The policy, standard, procedure, RACI matrix and control matrix are all built from it, so they stay consistent: if the policy says access is reviewed quarterly, the standard, the procedure and the control say the same.' },
        { h: 'Parts of the platform' },
        { table: { head: ['Part', 'What it holds'], rows: [
          ['Governance library', 'Policies, standards and procedures, their status and review dates, and the hierarchy between them.'],
          ['Accountability', 'Role definitions and a RACI matrix for each domain.'],
          ['Control environment', 'The control library, the frameworks, the mappings between them, and the evidence register.'],
          ['Risk', 'The risk register and corrective actions.'],
          ['Assurance', 'Gap assessment, the Statement of Applicability, findings, imports, management reviews and reports.']
        ] } },
        { h: 'Getting around' },
        { ul: [
          'The sidebar groups the screens by part; the numbers beside them count what each holds.',
          'The search box at the top (or Ctrl+K) searches documents, controls, requirements and roles together.',
          'The language button switches the interface between Arabic and English; the moon button switches to the dark theme.',
          'The bell shows notifications: what is waiting for your review, approval or publication, document review dates, new comments and findings, and evidence waiting to be verified.'
        ] },
        { go: { to: '/dashboard', label: 'Open the dashboard' } }
      ]
    },
    {
      slug: 'getting-started', group: 'start', title: 'Getting started',
      summary: 'Signing in, choosing the applicable frameworks, and the organisation profile.',
      blocks: [
        { h: 'Signing in' },
        { p: 'Sign in with your email and password. If your role is one that requires two-step verification, the platform asks you to set it up on first sign-in with an authenticator app, and gives you ten recovery codes to keep somewhere safe.' },
        { h: 'Choosing the applicable frameworks' },
        { p: 'The first question for an administrator or GRC manager is which frameworks and regulations the organisation is subject to. The choice is recorded once; every generated document cites it, and the dashboard measures compliance against it.' },
        { tip: 'Choose what actually applies. A framework that does not, such as operational technology controls for an organisation with no industrial control systems, shows up as a gap that is not there.' },
        { h: 'Organisation profile' },
        { p: 'Under Settings → Organisation: the organisation name, sector and size, regulators, technology environment, data classifications and risk appetite. These feed the generated text: the scope of a policy, for example, names the technology environment as you recorded it.' },
        { h: 'Document identity' },
        { p: 'Under Settings → Document identity: upload the organisation logo and choose its colours and fonts. The identity appears on every file the platform exports (see Exports).' },
        { go: { to: '/settings', label: 'Open Settings' } }
      ]
    },
    {
      slug: 'roles', group: 'start', title: 'Roles and permissions',
      summary: 'The seven roles, what each can do, and segregation of duties.',
      blocks: [
        { p: 'Each user has one role that decides what they can do. Permissions are tied to actions rather than screens, and some are refused to the person whose work it is even when their role holds them.' },
        { table: { head: ['Role', 'Main permissions'], rows: [
          ['Administrator', 'Everything, including managing users and their roles.'],
          ['GRC Manager', 'Generating, editing and publishing documents, organisation settings, management reviews, and the audit log.'],
          ['Cybersecurity User', 'Generating, editing and submitting documents; controls, evidence, risks and corrective actions.'],
          ['Reviewer', 'Reviewing and commenting on documents; verifying evidence and corrective actions.'],
          ['Approver', 'Approving documents and accepting risks.'],
          ['Auditor', 'Reading everything; findings and gap assessment; independent verification; the audit log.'],
          ['Read Only', 'Reading and exporting documents, controls, risks and reports, without changing anything.']
        ] } },
        { h: 'Segregation of duties' },
        { ul: [
          'Nobody approves a document they own, and it does not appear in their approval queue.',
          'Nobody verifies evidence they collected, or a corrective action they completed.',
          'A document owner does not score the quality of their own document.',
          'Only an Approver or Administrator accepts a risk, with a recorded rationale and an expiry date.'
        ] },
        { h: 'Two-step verification' },
        { p: 'The administrator chooses, under Settings → Organisation, which roles cannot sign in without two-step verification. Any user can turn it on for their own account under Settings → My account.' }
      ]
    },
    {
      slug: 'generate', group: 'documents', title: 'Generating documents',
      summary: 'Generating a complete package for a domain: policy, standard, procedure, roles and matrices.',
      blocks: [
        { p: 'Generation produces a package for one domain, every document built from the same domain model so they stay consistent.' },
        { h: 'Steps' },
        { ol: [
          'Open Generate and choose the document types: policy, standard, procedure, guideline, framework, roles and responsibilities, RACI matrix, control matrix.',
          'Choose the domain, such as Identity & Access Management or Human Resources Security.',
          'Check the organisation details and the domain\'s defined values, such as the access review frequency or the log retention period, and change what you need. Choose the language, classification, owner and approver.',
          'Open Preview package to see the documents, controls and evidence that will be created, and the assumptions the generation rests on.',
          'Select Generate package. The documents are created as drafts.'
        ] },
        { h: 'Defined values' },
        { p: 'Numbers in the documents — frequencies, deadlines, thresholds — are not typed into the text; they come from the domain\'s defined values. Changing a value changes it in every document in the domain, and the quality review warns if someone edits a number in one document so that it disagrees with the defined value.' },
        { h: 'Arabic and English versions' },
        { p: 'Generating an Arabic package for a domain that already has an English one creates Arabic documents linked to the originals, without a second set of controls. Each document page links to its version in the other language.' },
        { note: 'A package covers every requirement of the applicable frameworks that belongs to its domain, so reviewing it raises no missing-control recommendations.' },
        { go: { to: '/generator', label: 'Open Generate' } }
      ]
    },
    {
      slug: 'document-structure', group: 'documents', title: 'What the documents contain',
      summary: 'What each document type holds, and how it links to the requirements.',
      blocks: [
        { table: { head: ['Document', 'What it sets out'], rows: [
          ['Policy', 'The organisation\'s mandatory position: what must be achieved. Each statement cites, in brackets, the requirements it addresses, and beneath it sets out in full every legislative and regulatory control it cites, down to the subcontrols, as numbered subclauses (4.2.1, 4.2.2).'],
          ['Standard', 'The measurable requirements. Each requirement is split into numbered clauses with the role accountable for each, followed by the table of defined values.'],
          ['Procedure', 'Step-by-step execution in a table of input, step, responsible and output, with decision points and a process flow.'],
          ['Guideline', 'Implementation guidance that creates no obligation.'],
          ['Roles and responsibilities', 'Each role\'s purpose, authority, responsibilities, approvals and escalations.'],
          ['RACI matrix', 'Who is responsible, accountable, consulted and informed for each activity.'],
          ['Control matrix', 'The controls, their evidence and indicators, and their framework mappings.']
        ] } },
        { h: 'The document page' },
        { ul: [
          'Content: the document\'s sections, each labelled with where it came from (organisational policy, organisational standard, user input...).',
          'Quality review: the automated check (see Quality and consistency).',
          'Traceability: the controls that implement the document, and the documents linked to it.',
          'History: versions, and every submission, approval and publication.',
          'Comments: reviewers\' notes.',
          'Process flow (procedures): the lanes and decision points.'
        ] },
        { h: 'Editing' },
        { p: 'Each section is edited with the Edit button beside it. A section that was an automated recommendation is labelled user input once edited, so it stays clear what a person has reviewed. A published document cannot be edited until it is opened for revision.' }
      ]
    },
    {
      slug: 'lifecycle', group: 'documents', title: 'Document lifecycle',
      summary: 'From draft through review, approval and publication, then periodic review.',
      blocks: [
        { table: { head: ['Status', 'Meaning', 'Who moves it on'], rows: [
          ['Draft', 'Being prepared.', 'The GRC Manager or a Cybersecurity User submits it for review.'],
          ['Under review', 'Waiting for review and approval.', 'The Approver approves it, or the Reviewer or GRC Manager returns it to draft for changes.'],
          ['Approved', 'Approved, not yet published.', 'The GRC Manager or Administrator publishes it.'],
          ['Published', 'In force, with an effective date and a next review date.', 'Opened for revision when needed.'],
          ['Under revision', 'Published and being changed for a new version.', 'Submitted for review again, or published directly by the GRC Manager.'],
          ['Retired', 'No longer in force; its record is kept.', 'Can be returned to draft to be issued again.']
        ] } },
        { h: 'Periodic review' },
        { p: 'Every published document has a review date, set by default one year after publication. The dashboard lists documents due for review within 90 days, and notifications remind the owner ahead of the date. A document past its review date is raised as a finding.' },
        { h: 'The document record' },
        { p: 'Every submission, approval and publication is recorded with the person, their role and the date, and appears in the approval table of the Word file.' },
        { go: { to: '/my-work', label: 'Open My work' } }
      ]
    },
    {
      slug: 'procedures', group: 'documents', title: 'Procedures and process flows',
      summary: 'The steps table, the swimlane diagram, and the PowerPoint swimlane export.',
      blocks: [
        { h: 'The steps table' },
        { p: 'A procedure\'s detailed steps are a four-column table: the input (what starts the step), the step (its number, name and description, and its decision if it has one), the responsible role, and the output (what the step hands on).' },
        { p: 'The first step\'s input is the event that starts the procedure; each later step takes the previous step\'s output unless another input is stated.' },
        { h: 'The process flow' },
        { p: 'The Process flow tab draws the procedure as horizontal lanes, one per responsible party. It opens at a start event and closes at an end event, and a step that ends in a question is followed by a decision diamond. The outcome that carries on stays on the main line; the other drops to a dashed box below the decision.' },
        { h: 'Swimlane export' },
        { p: 'The PowerPoint button on a procedure exports the diagram as an editable slide: every lane, box and arrow is a separate shape that can be moved or retyped. The full wording of each step is in the speaker notes.' },
        { note: 'The PowerPoint arrows are not glued to the boxes; move a box\'s arrows with it.' }
      ]
    },
    {
      slug: 'quality', group: 'documents', title: 'Quality and consistency',
      summary: 'The automated document check, and finding contradictions between documents.',
      blocks: [
        { p: 'The platform checks every document and every domain, and records what it finds as findings with a severity and a recommendation.' },
        { table: { head: ['Category', 'What is checked'], rows: [
          ['Completeness', 'The sections a document type requires are present.'],
          ['Consistency', 'Values agree across a domain\'s documents: a standard saying quarterly and a procedure saying annually is a contradiction.'],
          ['Ambiguity', 'Unmeasurable wording such as "periodically" or "adequate" with no value.'],
          ['Accountability', 'Every clause and activity has a responsible role.'],
          ['Auditability', 'Every control has evidence and an indicator.'],
          ['Compliance', 'Every requirement of the applicable frameworks has a mapped control.'],
          ['Currency', 'A document with no review date, or past it.']
        ] } },
        { h: 'Review with AI' },
        { p: 'The Review with AI button on a document runs the full review and gives the document a readiness score and its findings in the Quality review tab. While a section is being edited, the Improve, Formalise and Shorten tools suggest rewording it; nothing they suggest is saved until you save the section yourself.' },
        { go: { to: '/findings', label: 'Open Findings' } }
      ]
    },
    {
      slug: 'controls', group: 'controls', title: 'Controls, frameworks and mappings',
      summary: 'The control library, the frameworks, and how each control maps to requirements.',
      blocks: [
        { h: 'The control library' },
        { p: 'Each requirement in a domain model becomes a control with an identifier (such as IAM-001), a type (preventive, detective, corrective, directive), a responsible role, a risk rating, a performance indicator and required evidence. The control page also shows the risks it treats and the requirements it covers.' },
        { h: 'Frameworks' },
        { p: 'The platform shows the frameworks in its knowledge base, with their requirements and coverage. Requirement text in the catalogue is reference data compiled for mapping, and must be checked against the official publication.' },
        { tip: 'To replace the reference data with the official text, import your copy on the Frameworks page as a spreadsheet of requirement numbers and text. Rows are updated in place and nothing is deleted, so existing mappings stay intact.' },
        { h: 'Mappings' },
        { p: 'The Mappings page shows how a requirement in one framework corresponds to requirements in others (ECC 2-2-3-2 against ISO A.8.5, for example), and which of the organisation\'s controls covers them.' },
        { h: 'Statement of Applicability' },
        { p: 'For each control: whether it applies, why, and its implementation status (implemented, planned, not implemented, excluded). Exported to Excel for the auditor.' },
        { go: { to: '/controls', label: 'Open the control library' } }
      ]
    },
    {
      slug: 'evidence', group: 'controls', title: 'Evidence',
      summary: 'Collecting evidence for each control, and verifying it.',
      blocks: [
        { p: 'The evidence register sets out, for each control, the evidence required, how often, where it comes from and how long it is kept.' },
        { ol: [
          'Open the evidence item and attach the file. Its fingerprint (SHA-256) is stored so it can later be shown not to have changed.',
          'The item becomes Collected, with the collection date.',
          'Someone other than the collector (a Reviewer, Auditor or GRC Manager) verifies it, and it becomes Verified.'
        ] },
        { p: 'Evidence that has been collected but not yet verified is notified to everyone who can verify it, and the audit readiness report shows the share of verified evidence in each domain.' },
        { go: { to: '/evidence', label: 'Open the evidence register' } }
      ]
    },
    {
      slug: 'gap-assessment', group: 'controls', title: 'Gap assessment',
      summary: 'Assessing the organisation against a framework, requirement by requirement.',
      blocks: [
        { p: 'An assessment creates an item for each requirement of the chosen framework. Each item has the current state, the target state, the gap, the risk, the recommendation, an owner and a due date.' },
        { ul: [
          'Compliant: a mapped control covers the requirement fully.',
          'Partially compliant: a control covers part of it.',
          'Non-compliant: no control covers it.',
          'Not applicable: with a recorded rationale.'
        ] },
        { p: 'To treat a gap, raise a corrective action on the Corrective actions page with the gap item as its source. The internal audit report is exported to Word from the assessment page.' },
        { go: { to: '/gap-assessment', label: 'Open Gap assessment' } }
      ]
    },
    {
      slug: 'risks', group: 'risk', title: 'Risk register',
      summary: 'Inherent and residual risk, treatment, and risk acceptance.',
      blocks: [
        { p: 'Every requirement in a domain model states the risk it addresses; the register turns those into risks linked to the control that treats them.' },
        { h: 'Assessment' },
        { ul: [
          'Inherent risk: likelihood and impact before controls.',
          'Residual risk: after the controls. It does not count as assessed until a person assesses it, and no reduction is claimed before then.',
          'The matrix shows how risks are distributed; the coloured cells are the ones that hold risks.'
        ] },
        { h: 'Treatment and acceptance' },
        { p: 'Treatment options are mitigate, transfer, avoid or accept. Only an Approver or Administrator accepts a risk, with a rationale and an expiry date; an acceptance without an expiry is refused.' },
        { go: { to: '/risks', label: 'Open the risk register' } }
      ]
    },
    {
      slug: 'actions', group: 'risk', title: 'Findings and corrective actions',
      summary: 'From finding to action to independent verification.',
      blocks: [
        { p: 'Findings come from the quality review, from reviewers and auditors, or from analysing imported documents. Each has a severity and a recommendation.' },
        { ol: [
          'A corrective action is raised from a finding, a gap item or a risk, with an owner, a priority and a due date.',
          'The owner records progress, and can mark the action blocked with the reason.',
          'When the action arises from a finding, a gap item or an assessment, it cannot be completed without a root cause.',
          'Someone other than the owner (a Reviewer, Auditor or GRC Manager) verifies it, and it closes.'
        ] },
        { tip: 'The Corrective actions page has a filter for overdue actions, and the number still open shows beside it in the sidebar.' },
        { go: { to: '/actions', label: 'Open Corrective actions' } }
      ]
    },
    {
      slug: 'management-review', group: 'risk', title: 'Management reviews and reports',
      summary: 'Management review minutes, and the ready-made reports.',
      blocks: [
        { h: 'Management review' },
        { p: 'The GRC Manager records the management review meeting. Its inputs — compliance, risks, findings and actions — are kept as they stood on the day, so they do not change afterwards. Each decision in the minutes can become a corrective action with an owner and a date, and the minutes are locked once closed.' },
        { h: 'Reports' },
        { ul: [
          'Compliance: compliance coverage, policy coverage, control coverage, framework mapping and gap assessment.',
          'Accountability: roles and responsibilities, and RACI assignment.',
          'Documents: document status and review status.',
          'Assurance: audit readiness, the internal audit plan, and management review inputs.'
        ] },
        { p: 'Every report exports to Excel or PDF.' },
        { go: { to: '/reports', label: 'Open Reports' } }
      ]
    },
    {
      slug: 'imports', group: 'risk', title: 'Importing and analysing documents',
      summary: 'Analysing the organisation\'s existing documents against the requirements.',
      blocks: [
        { p: 'Upload a policy, standard or procedure from Word, PDF or Excel. The platform identifies its domain and type, then compares it with the domain model.' },
        { h: 'What is checked' },
        { ul: [
          'Requirements the document does not address.',
          'Values that contradict the defined values in the organisation\'s standard.',
          'Unmeasurable wording, and duplication of existing controls.',
          'Owner, approval, version, review date and classification.',
          'References to superseded editions, such as ECC-1:2018 or ISO/IEC 27001:2013.'
        ] },
        { h: 'Procedure check' },
        { p: 'When the document is a procedure, it is also checked for what makes it operable: an input, output and responsible role for each step, service levels, an exception path, escalation, a verification step, performance indicators, records, and related documents.' },
        { h: 'Arabic wording' },
        { p: 'Arabic documents are checked for common errors, such as ادارة for إدارة and احد الثغرات for إحدى الثغرات, and for numbers written with a hyphen that reverses in right-to-left text.' },
        { go: { to: '/imports', label: 'Open Imports' } }
      ]
    },
    {
      slug: 'exports', group: 'admin', title: 'Exports and document identity',
      summary: 'Exporting to Word, PDF, Excel and PowerPoint in the organisation\'s identity.',
      blocks: [
        { table: { head: ['Format', 'What exports'], rows: [
          ['Word', 'Any document, with a cover, the document control, approval and version tables, and contents. Arabic documents are laid out right to left.'],
          ['PDF', 'Any document, the reports, the internal audit report and management review minutes. Arabic PDFs use IBM Plex Sans Arabic, which ships with the platform.'],
          ['Excel', 'Control matrices, RACI matrices, mappings, gaps, registers, the Statement of Applicability, and reports.'],
          ['PowerPoint', 'The swimlane diagram of a procedure.']
        ] } },
        { h: 'Language of files' },
        { p: 'Every file comes out in the language the interface is set to. Switch the interface to Arabic and the next export is Arabic throughout: headings, labels, column headers, sheet names and the knowledge-base wording; Excel sheets open right to left.' },
        { p: 'A document exports in the other language from its translation when one exists; otherwise the platform builds that language from the same domain, frameworks and parameters, keeping any section a person wrote as written.' },
        { h: 'Document identity' },
        { p: 'Under Settings → Document identity:' },
        { ul: [
          'Logo: PNG or JPEG up to 512 KB, ideally on a transparent background. It appears on the cover and in the page header.',
          'Colours: six ready palettes, or your own. The primary colour must carry white text and the accent must read on white; colours that do not are refused.',
          'Type: four pairings of a Latin and an Arabic font. All ship with Windows; on a Mac, Segoe UI and Sakkal Majalla are replaced by a similar font.'
        ] },
        { note: 'If the chosen font is not installed on the reader\'s computer, a similar one is substituted automatically.' }
      ]
    },
    {
      slug: 'settings', group: 'admin', title: 'Settings and users',
      summary: 'The organisation profile, users, and the audit log.',
      blocks: [
        { table: { head: ['Tab', 'What it holds', 'Who changes it'], rows: [
          ['Organisation', 'The organisation profile, applicable frameworks, operational technology and cloud scope, and two-step verification roles.', 'Administrator and GRC Manager'],
          ['Document identity', 'Logo, colours and fonts.', 'Administrator and GRC Manager'],
          ['Users and access', 'Adding users and their roles, and resetting passwords.', 'Administrator'],
          ['My account', 'Password and two-step verification.', 'Each user, for their own account'],
          ['Audit log', 'Every action on the platform: who, when and the outcome.', 'Read by the Administrator, GRC Manager and Auditor'],
          ['System', 'Platform status, the knowledge base and the AI provider.', '—']
        ] } },
        { p: 'A user whose password has been reset must change it on first sign-in before doing anything else.' },
        { go: { to: '/settings', label: 'Open Settings' } }
      ]
    },
    {
      slug: 'faq', group: 'reference', title: 'Frequently asked questions',
      summary: 'Short answers to the most common questions.',
      blocks: [
        { h: 'Why can\'t I see the Generate button?' },
        { p: 'Generation is for the Administrator, GRC Manager and Cybersecurity User. Other roles read, review and approve.' },
        { h: 'Why isn\'t a document in my approval queue?' },
        { p: 'If you own it, it will not be: a document must be approved by someone other than its owner.' },
        { h: 'I changed a number in a procedure and got a consistency finding. Why?' },
        { p: 'The number disagrees with the defined value in the standard. Either put it back to the defined value, or change the defined value itself so it changes in every document in the domain.' },
        { h: 'Can I export an Arabic document to PDF?' },
        { p: 'Yes. With the interface in Arabic, the PDF is Arabic and laid out right to left.' },
        { h: 'The regulatory text in the catalogue is abbreviated. How do I get the full text?' },
        { p: 'Import the official copy on the Frameworks page, then regenerate the policy: each policy quotes in full the controls it cites. A spreadsheet holding several publications is accepted (a column naming the publication of each row), and an Arabic text column is read beside the English. The platform does not write a regulator\'s text itself, so that nothing is attributed to a regulator that it did not say; until the text is imported, the policy lists the controls it cites without quoting them.' },
        { h: 'I changed the document identity; why doesn\'t an old file show it?' },
        { p: 'The identity is applied when a file is exported. Export it again.' }
      ]
    },
    {
      slug: 'glossary', group: 'reference', title: 'Glossary',
      summary: 'The terms used across the platform.',
      blocks: [
        { table: { head: ['Term', 'Meaning'], rows: [
          ['Domain', 'The unit the platform works in, such as Identity & Access Management. Each domain has one requirement model.'],
          ['Defined value', 'A number the domain commits to, such as the access review frequency, used in all of its documents.'],
          ['Control', 'An action or configuration that meets a requirement, with an owner, evidence and an indicator.'],
          ['Regulatory requirement', 'A requirement from a framework or law the organisation is subject to, such as ECC 2-2-3-1.'],
          ['Inherent / residual risk', 'Risk before controls / after them.'],
          ['RACI', 'Responsible, Accountable, Consulted, Informed. Each activity has exactly one Accountable.'],
          ['Statement of Applicability', 'The list of controls with their applicability, rationale and implementation status.'],
          ['Root cause', 'Why a finding happened; recorded before a corrective action can be completed.'],
          ['Provenance', 'Where a text came from: a regulatory requirement, organisational policy, user input, or an automated recommendation.']
        ] } }
      ]
    }
  ]
};
