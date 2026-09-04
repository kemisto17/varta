export const TERMS_VERSION = '2026-09-04';
export const SUPPORT_EMAIL = 'kemisto17@gmail.com';
export const POLICY_URLS = {
  privacy: 'https://kemisto17.github.io/varta/privacy-policy/',
  deletion: 'https://kemisto17.github.io/varta/account-deletion/',
  terms: 'https://kemisto17.github.io/varta/terms/',
  childSafety: 'https://kemisto17.github.io/varta/child-safety/',
} as const;

// Keep the published Terms of Use page in sync when changing this version.
export const TERMS_SECTIONS = [
  { title: 'Who Varta is for', text: 'Varta is a campus community for verified university students and authorized campus organizations. Use accurate account information, keep your login secure, and do not impersonate another person or organization.' },
  { title: 'Content and conduct', text: 'You are responsible for the content you share and must have permission to share it. Do not post harassment, bullying, threats, hate speech, sexual exploitation, child sexual abuse material, non-consensual intimate content, graphic violence, scams, spam, or illegal content. Do not publish private information about others without permission or infringe intellectual property rights.' },
  { title: 'Child safety', text: 'Child sexual abuse and exploitation are prohibited. Do not use Varta to groom, exploit, sexualize, or endanger a minor. Report suspected abuse through the in-app reporting tools or contact kemisto17@gmail.com. Varta will review reports, remove prohibited material, and make legally required reports to the relevant authorities.' },
  { title: 'Reporting and moderation', text: 'Use Report on content or profiles to report abuse, and Block to restrict interactions. Varta may remove content or restrict accounts for violations of these terms. Contact kemisto17@gmail.com to ask about a moderation decision. Reports are reviewed by the moderation team.' },
  { title: 'Your content and privacy', text: 'You retain ownership of your content. By uploading it, you permit Varta to store, display, and process it to operate and moderate the service. Our Privacy Policy describes the data we collect, its use, and your choices.' },
  { title: 'Leaving Varta', text: 'You can request deletion of your account and associated personal data from Settings or the public Account Deletion page. Requests are verified and processed by support. Any data retained for legitimate security or legal reasons is handled as described in the Privacy Policy.' },
  { title: 'Changes and contact', text: 'Varta may update these terms as the service changes. When acceptance of a new version is required, you will be asked to review it before publishing again. For support, privacy requests, or questions about these terms, contact kemisto17@gmail.com.' },
] as const;
