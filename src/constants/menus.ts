import { env } from "@/env";

export type MenuProps = {
  // IMPORTANT: The label key for i18n
  label: string;
  path: string;
  // IMPORTANT: Whether the route needs to be authenticated
  needAuth?: boolean;
};

// TODO: Add your route menu here
export const APP_ROUTE_MENU: MenuProps[] = [
  {
    label: "home.title",
    path: "/",
    needAuth: true,
  },
  {
    label: "auth.title",
    path: env.NEXT_PUBLIC_AUTH_PATH,
    needAuth: false,
  },
  {
    label: "sideBar.create",
    path: "/create",
    needAuth: true,
  },
  {
    label: "sideBar.avatar",
    path: "/avatar",
    needAuth: true,
  },
  {
    label: "sideBar.voice",
    path: "/voice",
    needAuth: true,
  },
  {
    label: "sideBar.history",
    path: "/history",
    needAuth: true,
  },
];
