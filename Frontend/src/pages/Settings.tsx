import { useState, type FormEvent } from "react";
import { date } from "../lib/date";
import useSWR from "swr";
import { ShieldCheck, Server, Mail, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  PageHeading,
  TextField,
  ErrorState,
} from "../components/workspace/Common";
import { useAuth } from "../hooks/useAuth";
import { fetcher } from "../api/workspace";
import type { Readiness } from "../types/workspace";
export default function Settings() {
  const {
    user,
    updateProfile,
    changePassword,
    resendVerification,
    activeSessions,
    revokeSession,
    logout,
  } = useAuth();
  const { data: readiness } = useSWR<Readiness>("/health", fetcher);
  const [profile, setProfile] = useState({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
    }),
    [password, setPassword] = useState({
      currentPassword: "",
      newPassword: "",
    });
  function saveProfile(e: FormEvent) {
    e.preventDefault();
    updateProfile.mutate(profile);
  }
  function savePassword(e: FormEvent) {
    e.preventDefault();
    changePassword.mutate(password, {
      onSuccess: () => setPassword({ currentPassword: "", newPassword: "" }),
    });
  }
  return (
    <>
      <PageHeading
        eyebrow="MAKE IT YOUR WORKSPACE"
        title="Settings"
        description="Your profile, account security, and configuration readiness."
      />
      <Tabs defaultValue="profile">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Your profile</CardTitle>
              <CardDescription>
                Keep your name and contact email up to date.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveProfile}>
                <FieldGroup>
                  <div className="form-columns">
                    <TextField
                      id="profile-first"
                      label="First name"
                      value={profile.firstName}
                      onChange={(v) =>
                        setProfile((p) => ({ ...p, firstName: v }))
                      }
                      required
                    />
                    <TextField
                      id="profile-last"
                      label="Last name"
                      value={profile.lastName}
                      onChange={(v) =>
                        setProfile((p) => ({ ...p, lastName: v }))
                      }
                      required
                    />
                  </div>
                  <TextField
                    id="profile-email"
                    label="Email address"
                    type="email"
                    value={profile.email}
                    onChange={(v) => setProfile((p) => ({ ...p, email: v }))}
                    required
                  />
                  <div className="flex items-center justify-between gap-4">
                    <Badge
                      variant={user?.isEmailVerified ? "secondary" : "outline"}
                    >
                      {user?.isEmailVerified
                        ? "Email verified"
                        : "Verification pending"}
                    </Badge>
                    {!user?.isEmailVerified && (
                      <Button
                        variant="outline"
                        type="button"
                        size="sm"
                        onClick={() => resendVerification.mutate()}
                        disabled={resendVerification.isPending}
                      >
                        Resend verification
                      </Button>
                    )}
                  </div>
                  <Button
                    className="self-start"
                    disabled={updateProfile.isPending}
                  >
                    Save profile
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="security">
          <div className="flex flex-col gap-6 max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>Change password</CardTitle>
                <CardDescription>
                  At least 8 characters: uppercase, lowercase, number, and a
                  special character.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={savePassword}>
                  <FieldGroup>
                    <TextField
                      id="password-current"
                      label="Current password"
                      type="password"
                      autoComplete="current-password"
                      value={password.currentPassword}
                      onChange={(v) =>
                        setPassword((p) => ({ ...p, currentPassword: v }))
                      }
                      required
                    />
                    <TextField
                      id="password-new"
                      label="New password"
                      type="password"
                      autoComplete="new-password"
                      value={password.newPassword}
                      onChange={(v) =>
                        setPassword((p) => ({ ...p, newPassword: v }))
                      }
                      required
                    />
                    <Button
                      className="self-start"
                      disabled={changePassword.isPending}
                    >
                      Update password
                    </Button>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Active sessions</CardTitle>
                <CardDescription>
                  Review and revoke signed-in sessions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  {activeSessions.error ? (
                    <ErrorState message="Unable to load your sessions." />
                  ) : (
                    activeSessions.data?.data?.sessions.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <div>
                          <strong className="text-sm">
                            Signed in {date(s.createdAt)}
                          </strong>
                          <p className="text-xs text-muted-foreground">
                            {s.isExpired ? "Expired" : "Expires"}{" "}
                            {date(s.expiresAt)}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={revokeSession.isPending}
                          onClick={() => revokeSession.mutate(s.id)}
                        >
                          Revoke
                        </Button>
                      </div>
                    ))
                  )}
                  <Button
                    variant="outline"
                    className="self-start"
                    disabled={logout.isPending}
                    onClick={() => logout.mutate(true)}
                  >
                    Sign out of all devices
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="configuration">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Configuration readiness</CardTitle>
              <CardDescription>
                Configuration values stay on the server. No secrets are shown
                here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="configuration-list">
                {[
                  {
                    icon: Server,
                    label: "Neon PostgreSQL",
                    description:
                      "Persistent catalog, accounts, drafts, and history.",
                    ready: readiness?.databaseConfigured,
                  },
                  {
                    icon: KeyRound,
                    label: "Local authentication",
                    description: "JWT access and refresh secrets.",
                    ready: readiness?.authConfigured,
                  },
                  {
                    icon: Mail,
                    label: "Email delivery",
                    description:
                      "Verification and password recovery transport.",
                    ready: readiness?.emailConfigured,
                  },
                ].map((item) => (
                  <div key={item.label}>
                    <item.icon size={20} />
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.description}</p>
                    </div>
                    <Badge variant={item.ready ? "secondary" : "outline"}>
                      {item.ready ? "Configured" : "Setup required"}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-start gap-3 text-sm text-muted-foreground">
                <ShieldCheck size={18} />
                <p>
                  Product images stay at their public HTTPS URLs; only the links
                  are saved. Export workbooks are retained in the database.
                  Flipkart templates have seller-SKU restrictions; Amazon
                  listings need a supplied template.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
