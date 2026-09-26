import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/sell")({
  beforeLoad: () => {
    throw redirect({ to: "/new-sale" });
  },
  component: () => null,
});
