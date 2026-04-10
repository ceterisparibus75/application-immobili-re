"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart3, Building2, FileText, Landmark, User } from "lucide-react";

type Props = {
  dashboardContent: React.ReactNode;
  patrimoineContent: React.ReactNode;
  bauxContent: React.ReactNode;
  empruntsContent: React.ReactNode;
  profileContent: React.ReactNode;
};

export function ProprietaireTabs({
  dashboardContent,
  patrimoineContent,
  bauxContent,
  empruntsContent,
  profileContent,
}: Props) {
  return (
    <Tabs defaultValue="dashboard">
      <TabsList className="flex-wrap">
        <TabsTrigger value="dashboard">
          <BarChart3 className="h-4 w-4 mr-2" />
          Tableau de bord
        </TabsTrigger>
        <TabsTrigger value="patrimoine">
          <Building2 className="h-4 w-4 mr-2" />
          Patrimoine
        </TabsTrigger>
        <TabsTrigger value="baux">
          <FileText className="h-4 w-4 mr-2" />
          Baux
        </TabsTrigger>
        <TabsTrigger value="emprunts">
          <Landmark className="h-4 w-4 mr-2" />
          Emprunts
        </TabsTrigger>
        <TabsTrigger value="profile">
          <User className="h-4 w-4 mr-2" />
          Profil propriétaire
        </TabsTrigger>
      </TabsList>
      <TabsContent value="dashboard">
        {dashboardContent}
      </TabsContent>
      <TabsContent value="patrimoine">
        {patrimoineContent}
      </TabsContent>
      <TabsContent value="baux">
        {bauxContent}
      </TabsContent>
      <TabsContent value="emprunts">
        {empruntsContent}
      </TabsContent>
      <TabsContent value="profile">
        {profileContent}
      </TabsContent>
    </Tabs>
  );
}
