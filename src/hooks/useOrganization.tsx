import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  created_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: "admin" | "perito" | "assistente";
  created_at: string;
  profiles?: { full_name: string; area_of_expertise: string | null };
}

interface OrgContextType {
  organizations: Organization[];
  currentOrg: Organization | null;
  currentRole: "admin" | "perito" | "assistente" | null;
  setCurrentOrg: (org: Organization) => void;
  loading: boolean;
  createOrg: (name: string) => Promise<Organization | null>;
  refreshOrgs: () => Promise<void>;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const OrganizationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrgState] = useState<Organization | null>(null);
  const [currentRole, setCurrentRole] = useState<"admin" | "perito" | "assistente" | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrgs = useCallback(async () => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrgState(null);
      setCurrentRole(null);
      setLoading(false);
      return;
    }

    const { data: members } = await supabase
      .from("org_members")
      .select("org_id, role")
      .eq("user_id", user.id);

    if (!members || members.length === 0) {
      setOrganizations([]);
      setCurrentOrgState(null);
      setCurrentRole(null);
      setLoading(false);
      return;
    }

    const orgIds = members.map((m: any) => m.org_id);
    const { data: orgs } = await supabase
      .from("organizations")
      .select("*")
      .in("id", orgIds);

    const orgList = (orgs || []) as Organization[];
    setOrganizations(orgList);

    const savedOrgId = localStorage.getItem(`cortex_org_${user.id}`);
    const saved = orgList.find((o) => o.id === savedOrgId);
    const selected = saved || orgList[0] || null;

    if (selected) {
      setCurrentOrgState(selected);
      const member = members.find((m: any) => m.org_id === selected.id);
      setCurrentRole((member?.role as any) || null);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const setCurrentOrg = (org: Organization) => {
    setCurrentOrgState(org);
    if (user) localStorage.setItem(`cortex_org_${user.id}`, org.id);
    // Update role
    supabase
      .from("org_members")
      .select("role")
      .eq("org_id", org.id)
      .eq("user_id", user!.id)
      .single()
      .then(({ data }) => {
        setCurrentRole((data?.role as any) || null);
      });
  };

  const createOrg = async (name: string): Promise<Organization | null> => {
    const slug = slugify(name) + "-" + Date.now().toString(36);
    const { data, error } = await supabase
      .from("organizations")
      .insert({ name, slug })
      .select()
      .single();

    if (error || !data) return null;
    const newOrg = data as Organization;
    await fetchOrgs();
    setCurrentOrg(newOrg);
    return newOrg;
  };

  return (
    <OrgContext.Provider value={{ organizations, currentOrg, currentRole, setCurrentOrg, loading, createOrg, refreshOrgs: fetchOrgs }}>
      {children}
    </OrgContext.Provider>
  );
};

export const useOrganization = () => {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrganization must be used within OrganizationProvider");
  return ctx;
};
