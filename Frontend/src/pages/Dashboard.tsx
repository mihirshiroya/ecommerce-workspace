import useSWR from "swr";
import {date} from '../lib/date';
import { Link } from "react-router-dom";
import {
  Store,
  Boxes,
  FilePenLine,
  Files,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Check,
  Clock3,
  Layers3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetcher, errorMessage } from "../api/workspace";
import type { DashboardData } from "../types/workspace";
import {
  PageHeading,
  EmptyState,
  Loading,
  ErrorState,
  TextLink,
} from "../components/workspace/Common";
import { useAuth } from "../hooks/useAuth";
export default function Dashboard() {
  const { user } = useAuth();
  const { data, error, isLoading, mutate } = useSWR<DashboardData>(
    "/workspace/dashboard",
    fetcher,
  );
  if (isLoading) return <Loading />;
  if (error)
    return (
      <ErrorState message={errorMessage(error)} retry={() => void mutate()} />
    );
  if (!data) return null;
  const stats = [
    {
      title: "Ecommerce accounts",
      value: data.accounts,
      icon: Store,
      sub: "Connected to your catalog",
      to: "/accounts",
    },
    {
      title: "Global SKUs",
      value: data.skus,
      icon: Boxes,
      sub: "One catalog, every marketplace",
      to: "/skus",
    },
    {
      title: "Saved drafts",
      value: data.drafts,
      icon: FilePenLine,
      sub: "Ready when you are",
      to: "/listing",
    },
    {
      title: "Exported files",
      value: data.exports,
      icon: Files,
      sub: "Account-ready spreadsheets",
      to: "/history",
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="YOUR WORKSPACE AT A GLANCE"
        title={`Good to see you, ${user?.firstName || "seller"}.`}
        description="A little less spreadsheet chaos. A lot more clarity."
        action={
          <Button asChild>
            <Link to="/listing">
              <Plus data-icon="inline-start" />
              Create bulk listing
            </Link>
          </Button>
        }
      />
      <section aria-label="Workspace metrics" className="metrics-grid">
        {stats.map((s) => (
          <Link to={s.to} key={s.title} className="metric-card">
            <div className="metric-label">
              {s.title}
              <s.icon size={17} />
            </div>
            <div className="metric-value">
              {s.value}
              <ArrowUpRight size={17} />
            </div>
            <p>{s.sub}</p>
          </Link>
        ))}
      </section>
      <section className="workflow-banner">
        <div className="workflow-banner-content">
          <Badge variant="outline">ONE WORKFLOW. EVERY ACCOUNT.</Badge>
          <h2>
            List once.
            <br />
            Make it work everywhere.
          </h2>
          <p>
            Choose your products, tailor each account,
            <br className="hidden sm:block" /> and leave the spreadsheet
            formatting to us.
          </p>
          <Button asChild>
            <Link to="/listing">
              Start a bulk listing
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
        <div className="workflow-illustration" aria-hidden="true">
          <div className="workflow-card main">
            <span className="workflow-card-icon">
              <Boxes size={23} />
            </span>
            <strong>Your global catalog</strong>
            <small>One source of truth</small>
            <div className="diagram-lines">
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="workflow-connector" />
          <div className="workflow-marketplaces">
            <div>
              <span className="market-letter meesho">m</span>
              <span>Meesho</span>
              <Check size={15} />
            </div>
            <div>
              <span className="market-letter flipkart">f</span>
              <span>Flipkart</span>
              <small>XLSX pending</small>
            </div>
            <div>
              <span className="market-letter amazon">a</span>
              <span>Amazon</span>
              <small>Catalog only</small>
            </div>
          </div>
        </div>
      </section>
      <div className="dashboard-columns">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Pick up where you left off</CardTitle>
              <CardDescription>
                Your most recent listing drafts.
              </CardDescription>
            </div>
            <TextLink to="/listing">View all</TextLink>
          </CardHeader>
          <CardContent>
            {!data.recentDrafts.length ? (
              <EmptyState
                title="A fresh start for your next listing"
                description="Save a draft as you work. Your product details and account selections will be right here."
                action={
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/listing">
                      <Plus data-icon="inline-start" />
                      Create your first draft
                    </Link>
                  </Button>
                }
              />
            ) : (
              <div className="flex flex-col divide-y">
                {data.recentDrafts.map((d) => (
                  <Link
                    to={`/listing?draft=${d.id}`}
                    className="draft-row"
                    key={d.id}
                  >
                    <span className="list-icon">
                      <FilePenLine size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate">{d.name}</strong>
                      <small>
                        {d.template_key.split(":").join(" · ")} ·{" "}
                        {date(d.updated_at)}
                      </small>
                    </div>
                    <Badge variant="secondary">{d.status}</Badge>
                    <ArrowUpRight size={15} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>The latest from your workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.activity.length ? (
              <ol className="activity-list">
                {data.activity.map((a) => (
                  <li key={a.id}>
                    <span className="activity-dot">
                      <Clock3 size={13} />
                    </span>
                    <div>
                      <p>{a.summary}</p>
                      <small>{date(a.created_at)}</small>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState
                title="Your story starts here"
                description="New accounts, catalog updates, and exports will appear as you work."
              />
            )}
          </CardContent>
        </Card>
      </div>
      <div className="workspace-tip">
        <Layers3 size={18} />
        <p>
          <strong>A good place to start:</strong> add a seller account, create a
          global SKU, then build your first listing.
        </p>
        <TextLink to={data.accounts ? "/skus" : "/accounts"}>
          Let&apos;s do it
        </TextLink>
      </div>
    </>
  );
}
