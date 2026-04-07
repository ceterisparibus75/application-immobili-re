"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart3, Building2, User } from "lucide-react";

type Props = {
  dashboardContent: React.ReactNode;
  profileContent: React.ReactNode;
  societiesContent: React.ReactNode;
};

export function ProprietaireTabs({ dashboardContent, profileContent, societiesContent }: Props) {
  return (
    <Tabs defaultValue="dashboard">
      <TabsList>
        <TabsTrigger value="dashboard">
          <BarChart3 className="h-4 w-4 mr-2" />
          Tableau de bord
        </TabsTrigger>
        <TabsTrigger value="societies">
          <Building2 className="h-4 w-4 mr-2" />
          Sociétés
        </TabsTrigger>
        <TabsTrigger value="profile">
          <User className="h-4 w-4 mr-2" />
          Profil Propriétaire
        </TabsTrigger>
      </TabsList>
      <TabsContent value="dashboard">
        {dashboardContent}
      </TabsContent>
      <TabsContent value="societies">
        {societiesContent}
      </TabsContent>
      <TabsContent value="profile">
        {profileContent}
      </TabsContent>
    </Tabs>
  );
}
