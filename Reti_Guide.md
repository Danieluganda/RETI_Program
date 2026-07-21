**Laravel-based Consent Management App**

```text
consent-management-app/
│
├── app/
│   ├── Domains/
│   │   ├── Authentication/
│   │   │   ├── Controllers/
│   │   │   ├── Models/
│   │   │   ├── Policies/
│   │   │   └── Services/
│   │   │
│   │   ├── Organizations/
│   │   │   ├── Models/
│   │   │   │   └── Organization.php
│   │   │   ├── Services/
│   │   │   └── Policies/
│   │   │
│   │   ├── Programs/
│   │   │   ├── Models/
│   │   │   │   ├── Program.php
│   │   │   │   └── ProgramLocation.php
│   │   │   ├── Controllers/
│   │   │   └── Services/
│   │   │
│   │   ├── Participants/
│   │   │   ├── Models/
│   │   │   │   └── Participant.php
│   │   │   ├── Controllers/
│   │   │   ├── Requests/
│   │   │   └── Services/
│   │   │
│   │   ├── ConsentForms/
│   │   │   ├── Models/
│   │   │   │   ├── ConsentForm.php
│   │   │   │   ├── ConsentFormVersion.php
│   │   │   │   └── ConsentSection.php
│   │   │   ├── Controllers/
│   │   │   ├── Requests/
│   │   │   └── Services/
│   │   │
│   │   ├── Consents/
│   │   │   ├── Models/
│   │   │   │   ├── Consent.php
│   │   │   │   ├── ConsentSignature.php
│   │   │   │   └── ConsentAttachment.php
│   │   │   ├── Controllers/
│   │   │   ├── Requests/
│   │   │   ├── Services/
│   │   │   │   ├── ConsentService.php
│   │   │   │   ├── SignatureService.php
│   │   │   │   └── ConsentReferenceService.php
│   │   │   ├── Policies/
│   │   │   └── Events/
│   │   │
│   │   ├── Interpreters/
│   │   │   ├── Models/
│   │   │   │   └── InterpreterDeclaration.php
│   │   │   └── Services/
│   │   │
│   │   ├── Withdrawals/
│   │   │   ├── Models/
│   │   │   │   └── ConsentWithdrawal.php
│   │   │   ├── Controllers/
│   │   │   └── Services/
│   │   │
│   │   ├── Documents/
│   │   │   ├── Services/
│   │   │   │   ├── ConsentPdfService.php
│   │   │   │   └── FileStorageService.php
│   │   │   └── Templates/
│   │   │
│   │   ├── Reporting/
│   │   │   ├── Controllers/
│   │   │   ├── Exports/
│   │   │   │   ├── ConsentsExport.php
│   │   │   │   └── WithdrawalsExport.php
│   │   │   └── Services/
│   │   │
│   │   └── Audit/
│   │       ├── Models/
│   │       │   └── AuditLog.php
│   │       ├── Listeners/
│   │       └── Services/
│   │
│   ├── Http/
│   │   ├── Middleware/
│   │   └── Controllers/
│   │
│   ├── Livewire/
│   │   ├── Dashboard/
│   │   ├── Participants/
│   │   ├── Consents/
│   │   │   ├── CreateConsent.php
│   │   │   ├── ConsentWizard.php
│   │   │   ├── ConsentDecision.php
│   │   │   ├── SignatureCapture.php
│   │   │   ├── AttachmentUpload.php
│   │   │   ├── InterpreterForm.php
│   │   │   └── ConsentReview.php
│   │   ├── Withdrawals/
│   │   └── Reports/
│   │
│   ├── Jobs/
│   │   ├── GenerateConsentPdf.php
│   │   ├── UploadConsentAttachment.php
│   │   └── ExportConsentRecords.php
│   │
│   └── Notifications/
│       ├── ConsentRecordedNotification.php
│       └── ConsentWithdrawnNotification.php
│
├── database/
│   ├── migrations/
│   │   ├── create_organizations_table.php
│   │   ├── create_programs_table.php
│   │   ├── create_participants_table.php
│   │   ├── create_consent_forms_table.php
│   │   ├── create_consent_form_versions_table.php
│   │   ├── create_consents_table.php
│   │   ├── create_consent_signatures_table.php
│   │   ├── create_consent_attachments_table.php
│   │   ├── create_interpreter_declarations_table.php
│   │   ├── create_consent_withdrawals_table.php
│   │   └── create_audit_logs_table.php
│   │
│   ├── seeders/
│   │   ├── RolesSeeder.php
│   │   ├── PermissionsSeeder.php
│   │   ├── ProgramSeeder.php
│   │   └── ConsentFormSeeder.php
│   │
│   └── factories/
│
├── resources/
│   ├── views/
│   │   ├── layouts/
│   │   │   ├── app.blade.php
│   │   │   ├── guest.blade.php
│   │   │   └── participant.blade.php
│   │   │
│   │   ├── dashboard/
│   │   ├── participants/
│   │   ├── programs/
│   │   ├── consents/
│   │   │   ├── index.blade.php
│   │   │   ├── create.blade.php
│   │   │   ├── show.blade.php
│   │   │   ├── review.blade.php
│   │   │   └── receipt.blade.php
│   │   │
│   │   ├── withdrawals/
│   │   ├── reports/
│   │   ├── settings/
│   │   └── pdf/
│   │       └── consent-certificate.blade.php
│   │
│   ├── js/
│   │   ├── app.js
│   │   ├── signature-pad.js
│   │   ├── camera-capture.js
│   │   └── offline-sync.js
│   │
│   └── css/
│       └── app.css
│
├── routes/
│   ├── web.php
│   ├── api.php
│   ├── admin.php
│   └── participant.php
│
├── storage/
│   ├── app/
│   │   ├── private/
│   │   │   ├── signatures/
│   │   │   ├── thumbprints/
│   │   │   ├── attachments/
│   │   │   └── consent-pdfs/
│   │   └── exports/
│   │
│   └── logs/
│
├── tests/
│   ├── Feature/
│   │   ├── ConsentCreationTest.php
│   │   ├── ConsentDeclineTest.php
│   │   ├── SignatureUploadTest.php
│   │   ├── ThumbprintCaptureTest.php
│   │   ├── InterpreterDeclarationTest.php
│   │   ├── ConsentWithdrawalTest.php
│   │   └── AccessControlTest.php
│   │
│   └── Unit/
│       ├── ConsentServiceTest.php
│       └── ConsentReferenceServiceTest.php
│
├── public/
│   ├── manifest.json
│   ├── service-worker.js
│   └── icons/
│
├── config/
│   ├── consent.php
│   ├── filesystems.php
│   └── permissions.php
│
├── .env
├── composer.json
├── package.json
└── README.md
```

## User-facing app navigation

```text
Consent Management
│
├── Dashboard
│   ├── Total consents
│   ├── Consented
│   ├── Declined
│   ├── Withdrawn
│   └── Recent submissions
│
├── New Consent
│   ├── Program and activity
│   ├── Participant details
│   ├── Consent information
│   ├── Understanding confirmation
│   ├── Consent decision
│   ├── Signature or thumbprint
│   ├── Interpreter declaration
│   └── Review and submit
│
├── Consent Records
│   ├── All records
│   ├── Consented
│   ├── Declined
│   ├── Withdrawn
│   ├── Drafts
│   └── Search
│
├── Participants
│   ├── Participant list
│   ├── Participant profile
│   └── Consent history
│
├── Programs
│   ├── Programs
│   ├── Activities
│   ├── Locations
│   └── Data collectors
│
├── Consent Templates
│   ├── Current version
│   ├── Previous versions
│   ├── Privacy policy
│   └── Withdrawal contact
│
├── Withdrawals
│   ├── New withdrawal
│   ├── Pending
│   ├── Processed
│   └── Withdrawal history
│
├── Reports
│   ├── Consent summary
│   ├── Program report
│   ├── Collector report
│   ├── Location report
│   ├── Excel export
│   └── PDF export
│
├── Audit Logs
│
└── Settings
    ├── Organization
    ├── Users
    ├── Roles and permissions
    ├── File storage
    ├── Data retention
    └── Security
```

## Consent wizard structure

The main collection screen should be a wizard rather than one long form:

```text
Step 1: Session
├── Program
├── Activity
├── Location
└── Data collector

Step 2: Participant
├── Full name
├── Participant ID
├── Phone number
└── Optional demographic details

Step 3: Consent information
├── Purpose
├── Data collected
├── Data sharing
├── Participant rights
└── Withdrawal process

Step 4: Understanding
├── Information understood?
├── Questions answered?
└── Interpreter used?

Step 5: Decision
├── Yes, I consent
└── No, I do not consent

Step 6: Confirmation
├── Draw signature
├── Take signature photo
├── Upload PNG/JPG
├── Capture thumbprint
└── Date

Step 7: Interpreter
├── Interpreter name
├── Organization
├── Language/dialect
├── Signature
└── Date

Step 8: Review
├── Preview details
├── Preview signature
├── Correct information
└── Submit
```

## Storage tree

In Azure Blob, S3, or private local storage:

```text
consent-records/
│
├── organization-id/
│   ├── program-id/
│   │   ├── 2026/
│   │   │   ├── 07/
│   │   │   │   ├── CNS-2026-000001/
│   │   │   │   │   ├── participant-signature.png
│   │   │   │   │   ├── participant-thumbprint.jpg
│   │   │   │   │   ├── interpreter-signature.png
│   │   │   │   │   ├── supporting-document.jpg
│   │   │   │   │   └── consent-certificate.pdf
```

## Roles

```text
Super Administrator
├── Manage all organizations
└── Access system-wide configuration

Organization Administrator
├── Manage programs
├── Manage users
├── View all organization records
└── Generate reports

Data Protection Officer
├── Review consent records
├── Process withdrawals
├── Manage retention
└── Review audit logs

Supervisor
├── Review records
├── View collector performance
└── Export reports

Data Collector
├── Create consent records
├── Save drafts
└── View own submissions

Auditor
├── Read-only records
├── Read-only reports
└── Read-only audit logs
```

For the first MVP, I would reduce it to six modules: **Authentication, Programs, Participants, Consents, Withdrawals, and Reports**. The consent template builder, offline synchronization, integrations, and advanced audit management can come after the core workflow is stable.


Git repo:https://github.com/Danieluganda/RETI_Program