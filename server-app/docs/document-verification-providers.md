# Document verification providers

Driver onboarding requires driving licence, government ID and vehicle RC. Police verification and PAN are optional. A driver may submit a car while documents are awaiting review; going online and account activation still require approval.

## Admin workflow

Open a driver's detail page, choose the provider on each uploaded document and run verification. Provider choices are restricted to the document's type. The bundled transport, identity and background-check providers are simulations, explicitly labelled in the UI and attempt history. Admins can simulate a pass, rejection or provider outage. Only a pass approves the document; outages preserve the current document status and can be retried. Manual rejection remains available, but direct manual approval is blocked.

Run `php artisan migrate` before using the new controls. Attempts retain the provider, simulation flag, initiating admin, request UUID, provider reference, completion time and result. Uploading a replacement resets document approval while retaining history. Responses for replaced uploads or superseded attempts cannot approve the current file.

## Integrating a real provider

1. Implement `App\Services\DocumentVerification\VerificationProvider`. It receives the document, a request UUID and adapter options. Return `VerificationResult` with `approved`, `rejected` or `error`, a provider reference and a safe user-facing message. Do not treat transport success as verification success.
2. Register the adapter in `config/document_verification.php`, set `simulated` to false, and map the applicable document types to its ID. Each type can have multiple providers. Keep credentials and endpoint configuration on the server; do not accept URLs, secrets or approval outcomes from browser input. Non-simulated providers reject client-selected outcomes.
3. Use the request UUID as the provider's idempotency key. Apply bounded network timeouts and provider-specific authentication, response validation and retry policies. Read the file from storage or use a short-lived provider upload. Do not put document contents or identity numbers in logs or returned messages.
4. Add contract tests against the provider's sandbox, including mismatched identity/vehicle data, expired papers, rejection and outages, before changing the type mapping.

The current contract is synchronous. No real provider, credentials, webhook or background polling integration is included. Providers that return asynchronous jobs need a queue/callback adapter with signed callback validation and the same document-version and attempt-order guards. A crashed processing attempt can be retried after five minutes; a later attempt supersedes an older response.
