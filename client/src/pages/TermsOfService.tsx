import LegalPageLayout from "@/components/LegalPageLayout";
import MarkdownLegal from "@/components/MarkdownLegal";
import { TERMS_OF_SERVICE_MD } from "@/content/termsOfService";

export default function TermsOfService() {
  return (
    <LegalPageLayout>
      <MarkdownLegal content={TERMS_OF_SERVICE_MD} />
    </LegalPageLayout>
  );
}
