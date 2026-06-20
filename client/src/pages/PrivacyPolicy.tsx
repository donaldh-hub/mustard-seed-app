import LegalPageLayout from "@/components/LegalPageLayout";
import MarkdownLegal from "@/components/MarkdownLegal";
import { PRIVACY_POLICY_MD } from "@/content/privacyPolicy";

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout>
      <MarkdownLegal content={PRIVACY_POLICY_MD} />
    </LegalPageLayout>
  );
}
