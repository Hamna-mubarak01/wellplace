import { expect, type Locator, type Page } from "@playwright/test";

export const OPEN_DIALOG = "[role=dialog], [role=alertdialog]";

export interface DialogProbe {
  readonly route: string;
  readonly name: string;
  readonly reachOnlyWhenSeeded: string;
  readonly open: (page: Page) => Promise<boolean>;
}

async function clickFirst(trigger: Locator): Promise<boolean> {
  if ((await trigger.count()) === 0) return false;
  await trigger.first().click();
  return true;
}

async function openFromRowMenu(
  page: Page,
  menu: RegExp,
  item: RegExp,
): Promise<boolean> {
  const trigger = page.getByRole("button", { name: menu });
  if ((await trigger.count()) === 0) return false;

  await trigger.first().click();

  const entry = page.getByRole("menuitem", { name: item });
  await expect(entry.first()).toBeVisible();
  await entry.first().click();

  return true;
}

export const CONSOLE_DIALOGS: readonly DialogProbe[] = [
  {
    route: "/reception/board",
    name: "New booking",
    reachOnlyWhenSeeded: "the board renders no walk-in launcher",
    open: (page) =>
      clickFirst(page.getByRole("button", { name: "New booking" })),
  },
  {
    route: "/reception/tasks",
    name: "Create a task",
    reachOnlyWhenSeeded: "the tasks screen renders no create button",
    open: (page) => clickFirst(page.getByRole("button", { name: "New task" })),
  },
  {
    route: "/reception/tasks",
    name: "Take this note on?",
    reachOnlyWhenSeeded: "no shift note is open to hand over",
    open: (page) =>
      clickFirst(page.getByRole("button", { name: "Mark handed over" })),
  },
  {
    route: "/manage/settings",
    name: "Booking schedule",
    reachOnlyWhenSeeded: "settings could not be loaded",
    open: (page) => clickFirst(page.getByRole("button", { name: /^Booking schedule/ })),
  },
  {
    route: "/manage/messages",
    name: "Write a message template",
    reachOnlyWhenSeeded: "no message template is listed",
    open: (page) =>
      clickFirst(page.getByRole("button", { name: /^(Write|Replace)$/ })),
  },
  {
    route: "/manage/suites",
    name: "Edit suite",
    reachOnlyWhenSeeded: "no suite row is listed",
    open: async (page) => {
      if (!(await clickFirst(page.getByRole("link", { name: /^Suite \d+/ })))) return false;
      return clickFirst(page.getByRole("dialog").getByRole("button", { name: "Edit", exact: true }));
    },
  },
  {
    route: "/manage/suites",
    name: "Add a suite",
    reachOnlyWhenSeeded: "the suite inventory failed to load",
    open: (page) => clickFirst(page.getByRole("button", { name: "Add suite", exact: true })),
  },
  {
    route: "/manage/staff",
    name: "Permissions",
    reachOnlyWhenSeeded: "no colleague other than you is listed",
    open: (page) => openFromRowMenu(page, /^Actions for /, /^Permissions$/),
  },
];

export function dialogsFor(route: string): readonly DialogProbe[] {
  return CONSOLE_DIALOGS.filter((probe) => probe.route === route);
}
