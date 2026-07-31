import { Badge } from "@/components/ui/badge";

export function Default() {
  return <Badge>New</Badge>;
}

export function Secondary() {
  return <Badge variant="secondary">Draft</Badge>;
}

export function Destructive() {
  return <Badge variant="destructive">Failed</Badge>;
}

export function Outline() {
  return <Badge variant="outline">Pending</Badge>;
}
