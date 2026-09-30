"use client";

import { Armchair, Map as MapIcon, ShieldAlert, Shirt } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminForm, ImageInput, fileFrom, filesFrom, valueFrom } from "@/components/admin/AdminForm";
import { AppHeader } from "@/components/AppHeader";
import { AvatarSprite } from "@/components/AvatarSprite";
import { DashboardLink, MeFallback } from "@/components/PageStates";
import { FullPageState, Hint, Input, Label, Skeleton } from "@/components/ui";
import { api, upload } from "@/lib/api";
import { spaceSize } from "@/lib/format";
import type { Avatar, Element, MapSummary } from "@/lib/types";
import { useMe } from "@/lib/useMe";

// Uploaded PNGs get a public URL first, then the record is created with that URL
async function uploadImage(file: File, kind: "element" | "avatar" | "thumbnail") {
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", file);
  return (await upload<{ url: string }>("/admin/upload/image", form)).url;
}

const SECTIONS = [
  { id: "furniture", label: "Furniture", icon: Armchair },
  { id: "avatars", label: "Avatars", icon: Shirt },
  { id: "maps", label: "Maps", icon: MapIcon },
];

type Catalogue = { elements: Element[] | null; avatars: Avatar[] | null; maps: MapSummary[] | null };

export default function AdminPage() {
  const { me, status, error, retry } = useMe();
  const [catalogue, setCatalogue] = useState<Catalogue>({ elements: null, avatars: null, maps: null });
  const [loadError, setLoadError] = useState(false);
  // Bumped after an upload so the lists reload
  const [version, setVersion] = useState(0);

  const isAdmin = me?.role === "Admin";

  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([
      api<{ elements: Element[] }>("/space/elements"),
      api<{ avatars: Avatar[] }>("/user/avatars"),
      api<{ maps: MapSummary[] }>("/maps"),
    ]).then(
      ([e, a, m]) => {
        setCatalogue({ elements: e.elements, avatars: a.avatars, maps: m.maps });
        setLoadError(false);
      },
      () => setLoadError(true)
    );
  }, [isAdmin, version]);

  if (!me) return <MeFallback status={status} error={error} retry={retry} />;

  if (!isAdmin) {
    return (
      <FullPageState icon={ShieldAlert} title="Admins only" actions={<DashboardLink />}>
        This page is for managing furniture, avatars and maps. Ask an admin if you need something added.
      </FullPageState>
    );
  }

  const reload = () => setVersion((v) => v + 1);
  const existing = (count: number | undefined) =>
    loadError ? "Couldn't load the current list." : count === undefined ? "Loading…" : `${count} so far`;

  return (
    <div className="min-h-screen">
      <AppHeader me={me} />

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-4">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow">Admin</p>
          <h1 className="heading-display mt-1 text-3xl">Content</h1>
          <p className="mt-2 text-sm text-copy-lighter">What everyone can pick from when they build.</p>
          <nav className="mt-6 flex gap-1 overflow-x-auto lg:flex-col">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <a key={id} href={`#${id}`} className="menu-item shrink-0 font-semibold">
                <Icon className="size-4 text-copy-lighter" />
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="flex flex-col gap-6 lg:col-span-3">
          <AdminForm
            id="furniture"
            icon={Armchair}
            title="Furniture"
            description="A PNG sprite and its footprint in 32px tiles. Solid furniture blocks movement on its bottom row."
            submitLabel="Add furniture"
            onSubmit={async (form) => {
              const imageUrl = await uploadImage(fileFrom(form, "image"), "element");
              await api("/admin/element", {
                method: "POST",
                body: {
                  imageUrl,
                  width: Number(valueFrom(form, "width")),
                  height: Number(valueFrom(form, "height")),
                  static: (form.elements.namedItem("static") as HTMLInputElement).checked,
                },
              });
              reload();
              return "Furniture added. It's now in every owner's build palette.";
            }}
            aside={
              <>
                <Label>Existing furniture · {existing(catalogue.elements?.length)}</Label>
                <div className="flex flex-wrap gap-2">
                  {catalogue.elements === null &&
                    !loadError &&
                    [0, 1, 2, 3].map((i) => <Skeleton key={i} className="size-14" />)}
                  {catalogue.elements?.map((el) => (
                    // eslint-disable-next-line @next/next/no-img-element -- pixel-art sprite served from /public
                    <img
                      key={el.id}
                      src={el.imageUrl}
                      alt=""
                      title={`${el.width}×${el.height}${el.static ? ", solid" : ""}`}
                      className="pixelated size-14 rounded-lg border border-border bg-raised object-contain p-1"
                    />
                  ))}
                </div>
              </>
            }
          >
            <label className="block">
              <Label>Image (PNG)</Label>
              <ImageInput name="image" required />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <Label>Width (tiles)</Label>
                <Input name="width" type="number" min={1} defaultValue={1} required />
              </label>
              <label className="block">
                <Label>Height (tiles)</Label>
                <Input name="height" type="number" min={1} defaultValue={1} required />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input name="static" type="checkbox" defaultChecked className="size-4 accent-primary" />
              Solid (blocks movement)
            </label>
          </AdminForm>

          <AdminForm
            id="avatars"
            icon={Shirt}
            title="Avatar"
            description="A character sprite sheet with the same layout as the built-in ones: 32×32 frames, 3 per row, 4 rows."
            submitLabel="Add avatar"
            onSubmit={async (form) => {
              const imageUrl = await uploadImage(fileFrom(form, "sheet"), "avatar");
              await api("/admin/avatar", { method: "POST", body: { name: valueFrom(form, "name"), imageUrl } });
              reload();
              return "Avatar added. Players can pick it from their account menu.";
            }}
            aside={
              <>
                <Label>Existing avatars · {existing(catalogue.avatars?.length)}</Label>
                <div className="flex flex-wrap gap-2">
                  {catalogue.avatars?.map((a) => (
                    <div key={a.id} className="flex flex-col items-center gap-1 rounded-lg border border-border bg-raised p-2">
                      <AvatarSprite imageUrl={a.imageUrl} size="sm" />
                      <span className="max-w-16 truncate text-xs text-copy-lighter">{a.name ?? "Unnamed"}</span>
                    </div>
                  ))}
                </div>
              </>
            }
          >
            <label className="block">
              <Label>Name</Label>
              <Input name="name" required minLength={1} placeholder="Adam" />
            </label>
            <label className="block">
              <Label>Sprite sheet (PNG)</Label>
              <ImageInput name="sheet" required />
              <Hint>Pipoya / RPG Maker layout: rows face down, left, right, up, and the middle frame of each row is the standing pose.</Hint>
            </label>
          </AdminForm>

          <AdminForm
            id="maps"
            icon={MapIcon}
            title="Map"
            description={
              <>
                Export from Tiled as .tmj with embedded tilesets and 32px tiles, then upload every tileset image it uses.
                Tiles with a <code className="kbd">collides: true</code> property block movement.
              </>
            }
            submitLabel="Add map"
            onSubmit={async (form) => {
              const bundle = new FormData();
              bundle.append("map", fileFrom(form, "map"));
              for (const file of filesFrom(form, "tilesets")) bundle.append("tilesets", file);
              const { tmjUrl, width, height } = await upload<{ tmjUrl: string; width: number; height: number }>(
                "/admin/upload/map",
                bundle
              );
              const thumbnail = await uploadImage(fileFrom(form, "thumbnail"), "thumbnail");

              await api("/admin/map", {
                method: "POST",
                body: {
                  name: valueFrom(form, "name"),
                  thumbnail,
                  tmjUrl,
                  dimensions: `${width}x${height}`,
                  defaultElements: [],
                },
              });
              reload();
              return `Map added (${width}×${height} tiles). It's now in the create-space picker.`;
            }}
            aside={
              <>
                <Label>Existing maps · {existing(catalogue.maps?.length)}</Label>
                <div className="grid gap-3 sm:grid-cols-3">
                  {catalogue.maps?.map((m) => (
                    <div key={m.id} className="overflow-hidden rounded-lg border border-border bg-raised">
                      {/* eslint-disable-next-line @next/next/no-img-element -- pixel-art thumbnail served from /public */}
                      <img src={m.thumbnail} alt="" className="pixelated aspect-video w-full object-cover" />
                      <p className="truncate px-2 py-1.5 text-xs">
                        <span className="font-semibold">{m.name}</span>
                        <span className="text-copy-lighter"> · {spaceSize(m.dimensions)}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </>
            }
          >
            <label className="block">
              <Label>Name</Label>
              <Input name="name" required minLength={3} placeholder="Rooftop café" />
            </label>
            <label className="block">
              <Label>Map (.tmj)</Label>
              <Input name="map" type="file" accept=".tmj,.json,application/json" required />
            </label>
            <label className="block">
              <Label>Tileset images (PNG, select all)</Label>
              <Input name="tilesets" type="file" accept="image/png" multiple required />
            </label>
            <label className="block">
              <Label>Thumbnail (PNG)</Label>
              <ImageInput name="thumbnail" required />
            </label>
          </AdminForm>
        </main>
      </div>
    </div>
  );
}
