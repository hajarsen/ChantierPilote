import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  categoryLabel,
  simulationState,
  type ModelElement,
  type PlanningTask,
} from "./types";

export type Display = {
  selected: Set<string>;
  categories: Set<string>;
  isolate: boolean;
  simulation: boolean;
  date: string;
  tasks: PlanningTask[];
};
export type Viewer = {
  elements: ModelElement[];
  reset: () => void;
  focus: (id: string) => void;
  display: (settings: Display) => void;
  properties: (id: string) => Promise<Record<string, string>>;
  dispose: () => void;
};

export async function createViewer(
  container: HTMLDivElement,
  bytes: ArrayBuffer,
  format: "ifc" | "glb",
  onPick: (id: string, additive: boolean) => void,
  signal: AbortSignal,
): Promise<Viewer> {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#edf1e9");
  const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100000);
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  } catch {
    throw new Error(
      "La 3D nécessite WebGL. Activez l’accélération graphique du navigateur puis rechargez la page.",
    );
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute("aria-label", "Vue 3D de la maquette");
  container.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  const group = new THREE.Group();
  scene.add(group);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x819173, 2.6));
  const light = new THREE.DirectionalLight(0xffffff, 2.3);
  light.position.set(20, 35, 15);
  scene.add(light);
  const elements: ModelElement[] = [];
  const meshes = new Map<string, THREE.Mesh[]>();
  const facts = new Map<string, Record<string, string>>();
  let ifc: import("web-ifc").IfcAPI | undefined;
  let modelId = -1;
  let ifcReady = false;
  let disposed = false;
  let frame = 0;
  let vertices = 0;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let down = { x: 0, y: 0 };
  const resize = () => {
    if (disposed) return;
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  const onDown = (event: PointerEvent) => {
    down = { x: event.clientX, y: event.clientY };
  };
  const onUp = (event: PointerEvent) => {
    if (
      Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5 ||
      event.button !== 0
    )
      return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster
      .intersectObjects(group.children, true)
      .find((item) => item.object.visible);
    if (hit)
      onPick(
        hit.object.userData.elementId,
        event.ctrlKey || event.metaKey || event.shiftKey,
      );
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    controls.dispose();
    renderer.domElement.removeEventListener("pointerdown", onDown);
    renderer.domElement.removeEventListener("pointerup", onUp);
    scene.traverse((item) => {
      if (item instanceof THREE.Mesh || item instanceof THREE.LineSegments) {
        item.geometry.dispose();
        const materials = Array.isArray(item.material)
          ? item.material
          : [item.material];
        materials.forEach((material) => {
          for (const value of Object.values(material))
            if (value instanceof THREE.Texture) value.dispose();
          material.dispose();
        });
      }
    });
    if (ifc && modelId >= 0) ifc.CloseModel(modelId);
    if (ifcReady) ifc?.Dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
  signal.addEventListener("abort", cleanup, { once: true });
  function register(mesh: THREE.Mesh, element: ModelElement) {
    vertices += mesh.geometry.getAttribute("position").count;
    if (vertices > 4000000 || elements.length >= 20000)
      throw new Error(
        "Cette maquette dépasse la capacité de ce visualiseur. Exportez un bâtiment ou un lot plus léger.",
      );
    mesh.userData.elementId = element.id;
    mesh.userData.category = element.category;
    const old = mesh.material;
    const base = Array.isArray(old) ? old[0] : old;
    const color =
      base instanceof THREE.MeshStandardMaterial ||
      base instanceof THREE.MeshLambertMaterial ||
      base instanceof THREE.MeshPhongMaterial
        ? base.color.clone()
        : new THREE.Color("#aab6a0");
    mesh.material =
      base instanceof THREE.MeshStandardMaterial
        ? base.clone()
        : new THREE.MeshStandardMaterial({
            color,
            roughness: 0.8,
            metalness: 0.05,
            side: THREE.DoubleSide,
          });
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.side = THREE.DoubleSide;
    (Array.isArray(old) ? old : [old]).forEach((item) => item.dispose());
    mesh.userData.baseColor = color;
    if (!meshes.has(element.id)) {
      elements.push(element);
      meshes.set(element.id, []);
    }
    meshes.get(element.id)!.push(mesh);
  }
  try {
    if (signal.aborted) throw new DOMException("Annulé", "AbortError");
    if (format === "ifc") {
      const [{ IfcAPI }, { default: wasmUrl }] = await Promise.all([
        import("web-ifc"),
        import("web-ifc/web-ifc.wasm?url"),
      ]);
      if (signal.aborted) throw new DOMException("Annulé", "AbortError");
      ifc = new IfcAPI();
      await ifc.Init((path) => (path.endsWith(".wasm") ? wasmUrl : path), true);
      ifcReady = true;
      if (signal.aborted) {
        ifc.Dispose();
        throw new DOMException("Annulé", "AbortError");
      }
      modelId = ifc.OpenModel(new Uint8Array(bytes), {
        COORDINATE_TO_ORIGIN: true,
        MEMORY_LIMIT: 1024 * 1024 * 1024,
      });
      if (modelId < 0)
        throw new Error("Le lecteur IFC n’a pas pu ouvrir cette maquette.");
      ifc.StreamAllMeshes(modelId, (flatMesh) => {
        const line = ifc!.GetLine(modelId, flatMesh.expressID);
        const category = ifc!.GetNameFromTypeCode(line.type);
        const element = {
          id: String(flatMesh.expressID),
          name: String(
            line.Name?.value ||
              `${categoryLabel(category)} #${flatMesh.expressID}`,
          ),
          category,
        };
        facts.set(element.id, {
          Nom: element.name,
          Catégorie: categoryLabel(category),
          "Identifiant IFC": element.id,
          GlobalId: String(line.GlobalId?.value || "—"),
        });
        for (let i = 0; i < flatMesh.geometries.size(); i++) {
          const placed = flatMesh.geometries.get(i);
          const source = ifc!.GetGeometry(modelId, placed.geometryExpressID);
          const raw = ifc!.GetVertexArray(
            source.GetVertexData(),
            source.GetVertexDataSize(),
          );
          const indices = ifc!.GetIndexArray(
            source.GetIndexData(),
            source.GetIndexDataSize(),
          );
          const geometry = new THREE.BufferGeometry();
          const positions = new Float32Array(raw.length / 2);
          const normals = new Float32Array(raw.length / 2);
          for (let v = 0, out = 0; v < raw.length; v += 6, out += 3) {
            positions.set(raw.subarray(v, v + 3), out);
            normals.set(raw.subarray(v + 3, v + 6), out);
          }
          geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(positions, 3),
          );
          geometry.setAttribute(
            "normal",
            new THREE.BufferAttribute(normals, 3),
          );
          geometry.setIndex(new THREE.BufferAttribute(indices.slice(), 1));
          const mesh = new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({
              color: new THREE.Color(
                placed.color.x,
                placed.color.y,
                placed.color.z,
              ),
            }),
          );
          mesh.applyMatrix4(
            new THREE.Matrix4().fromArray(placed.flatTransformation),
          );
          register(mesh, element);
          group.add(mesh);
          source.delete();
        }
      });
      try {
        const tree = await ifc.properties.getSpatialStructure(modelId, false);
        const pending = [{ node: tree, level: "" }];
        while (pending.length) {
          const { node, level } = pending.pop()!;
          const nextLevel =
            node.type.toUpperCase() === "IFCBUILDINGSTOREY"
              ? String(
                  ifc.GetLine(modelId, node.expressID).Name?.value || "Niveau",
                )
              : level;
          const properties = facts.get(String(node.expressID));
          if (properties && nextLevel) properties["Niveau"] = nextLevel;
          for (const child of node.children || [])
            pending.push({ node: child, level: nextLevel });
        }
      } catch {
        /* Some valid geometry exports omit the spatial hierarchy. */
      }
    } else {
      const manager = new THREE.LoadingManager();
      manager.setURLModifier((url) => {
        if (!url.startsWith("blob:") && !url.startsWith("data:"))
          throw new Error(
            "Les ressources externes GLB ne sont pas autorisées.",
          );
        return url;
      });
      const gltf = await new GLTFLoader(manager).parseAsync(bytes, "");
      let index = 0;
      gltf.scene.traverse((item) => {
        if (!(item instanceof THREE.Mesh)) return;
        const id = `mesh:${index++}`;
        const element = {
          id,
          name: item.name || `Objet ${index}`,
          category: "MESH",
        };
        register(item, element);
        facts.set(id, {
          Nom: element.name,
          Identifiant: id,
          Format: "GLB",
          ...Object.fromEntries(
            Object.entries(item.userData)
              .filter(([, v]) =>
                ["string", "number", "boolean"].includes(typeof v),
              )
              .slice(0, 20)
              .map(([k, v]) => [k, String(v)]),
          ),
        });
      });
      group.add(gltf.scene);
    }
    if (signal.aborted) throw new DOMException("Annulé", "AbortError");
    if (!elements.length)
      throw new Error(
        "Aucune géométrie 3D exploitable n’a été trouvée dans ce fichier.",
      );
    const bounds = new THREE.Box3().setFromObject(group);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.length()) || size.length() <= 0)
      throw new Error("La géométrie de la maquette est invalide.");
    group.position.sub(center);
    const radius = Math.max(size.length(), 1);
    const grid = new THREE.GridHelper(radius * 2, 30, 0xb9c7ae, 0xd8dfd0);
    grid.position.y = -size.y / 2 - 0.03;
    scene.add(grid);
    const reset = () => {
      camera.position.set(radius * 0.8, radius * 0.65, radius * 0.95);
      camera.near = radius / 10000;
      camera.far = radius * 100;
      camera.updateProjectionMatrix();
      controls.target.set(0, 0, 0);
      controls.maxDistance = radius * 8;
      controls.update();
    };
    const animate = () => {
      if (disposed) return;
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    resize();
    reset();
    animate();
    renderer.domElement.dataset.elementCount = String(elements.length);
    return {
      elements,
      reset,
      focus: (id) => {
        const items = meshes.get(id);
        if (!items?.length) return;
        const box = new THREE.Box3();
        items.forEach((mesh) => box.expandByObject(mesh));
        const target = box.getCenter(new THREE.Vector3());
        const distance = Math.max(
          box.getSize(new THREE.Vector3()).length() * 1.8,
          radius * 0.12,
        );
        camera.position
          .copy(target)
          .add(
            new THREE.Vector3(1, 0.8, 1).normalize().multiplyScalar(distance),
          );
        controls.target.copy(target);
        controls.update();
      },
      display: ({ selected, categories, isolate, simulation, date, tasks }) => {
        const statesByElement = new Map<string, Set<string>>();
        if (simulation)
          for (const task of tasks) {
            const state = simulationState(task, date);
            for (const id of task.element_ids) {
              if (!statesByElement.has(id)) statesByElement.set(id, new Set());
              statesByElement.get(id)!.add(state);
            }
          }
        for (const [id, items] of meshes) {
          const states = statesByElement.get(id);
          const state = states?.has("working")
            ? "working"
            : states?.has("planned")
              ? "planned"
              : states?.size
                ? "finished"
                : "unlinked";
          items.forEach((mesh) => {
            mesh.visible =
              categories.has(mesh.userData.category) &&
              (!isolate || selected.has(id));
            const material = mesh.material as THREE.MeshStandardMaterial;
            const wasTransparent = material.transparent;
            material.color.copy(mesh.userData.baseColor);
            material.opacity = 1;
            material.transparent = false;
            if (simulation) {
              material.color.set(
                {
                  working: "#ed9854",
                  planned: "#c7d2c2",
                  finished: "#4b8a69",
                  unlinked: "#9daab0",
                }[state],
              );
              material.opacity = state === "planned" ? 0.2 : 1;
              material.transparent = state === "planned";
            }
            material.emissive.set(selected.has(id) ? "#d96527" : "#000000");
            material.emissiveIntensity = selected.has(id) ? 0.6 : 0;
            material.depthWrite = !material.transparent;
            if (wasTransparent !== material.transparent)
              material.needsUpdate = true;
          });
        }
      },
      properties: async (id) => {
        const properties = { ...facts.get(id) };
        const box = new THREE.Box3();
        for (const mesh of meshes.get(id) || []) box.expandByObject(mesh);
        const extent = box.getSize(new THREE.Vector3());
        properties["Encombrement X × Y × Z (m)"] = [
          extent.x,
          extent.y,
          extent.z,
        ]
          .map((value) =>
            new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 3 }).format(
              value,
            ),
          )
          .join(" × ");
        if (ifc && modelId >= 0 && !disposed) {
          const materials = await ifc.properties.getMaterialsProperties(
            modelId,
            Number(id),
            true,
          );
          const names = materials
            .map(
              (material) =>
                material.Name?.value || material.LayerSetName?.value,
            )
            .filter(Boolean);
          if (names.length) properties["Matériaux"] = names.join(", ");
          const sets = await ifc.properties.getPropertySets(
            modelId,
            Number(id),
            true,
          );
          for (const set of sets)
            for (const property of set.HasProperties || []) {
              const value = property.NominalValue?.value;
              if (["string", "number", "boolean"].includes(typeof value))
                properties[
                  `${set.Name?.value || "Propriété"} · ${property.Name?.value || "Valeur"}`
                ] = String(value);
              if (Object.keys(properties).length >= 60) break;
            }
        }
        return properties;
      },
      dispose: cleanup,
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}
