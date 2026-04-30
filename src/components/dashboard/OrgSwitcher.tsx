import { useOrganization } from "@/hooks/useOrganization";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";

const OrgSwitcher = ({ collapsed }: { collapsed: boolean }) => {
  const { organizations, currentOrg, setCurrentOrg } = useOrganization();

  if (organizations.length <= 1 || collapsed) {
    if (collapsed && currentOrg) {
      return (
        <div className="flex justify-center py-1" title={currentOrg.name}>
          <Building2 className="h-4 w-4 text-primary" />
        </div>
      );
    }
    return null;
  }

  return (
    <div className="px-2 py-1">
      <Select
        value={currentOrg?.id || ""}
        onValueChange={(val) => {
          const org = organizations.find((o) => o.id === val);
          if (org) setCurrentOrg(org);
        }}
      >
        <SelectTrigger className="h-8 text-xs bg-secondary/30 border-border/30">
          <Building2 className="h-3.5 w-3.5 mr-1.5 text-primary shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {organizations.map((org) => (
            <SelectItem key={org.id} value={org.id} className="text-xs">
              {org.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default OrgSwitcher;
