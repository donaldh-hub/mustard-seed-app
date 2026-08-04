import LegalPageLayout from "@/components/LegalPageLayout";
import MarkdownLegal from "@/components/MarkdownLegal";
import { SUBSCRIPTION_INFO_MD } from "@/content/subscriptionInfo";

export default function SubscriptionInfo() {
  return (
    <LegalPageLayout>
      <MarkdownLegal content={SUBSCRIPTION_INFO_MD} />
    </LegalPageLayout>
  );
}
