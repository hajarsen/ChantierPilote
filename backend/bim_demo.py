"""IFC2x3 duplex model used in Banyra's architecture demo."""
import re
from pathlib import Path

MODEL_PATH = Path(__file__).with_name("assets") / "Ifc2x3_Duplex_Architecture.ifc"

# Geometric building elements that the viewer can select and link to tasks.
PRODUCT_TYPES = frozenset({
    "IFCBEAM", "IFCBUILDINGELEMENTPROXY", "IFCCOLUMN", "IFCCOVERING",
    "IFCDOOR", "IFCFOOTING", "IFCFURNISHINGELEMENT", "IFCMEMBER",
    "IFCPLATE", "IFCRAILING", "IFCRAMP", "IFCRAMPFLIGHT", "IFCSLAB",
    "IFCSTAIR", "IFCSTAIRFLIGHT", "IFCWALL", "IFCWALLSTANDARDCASE",
    "IFCWINDOW", "IFCROOF", "IFCPILE",
})


def _arguments(value):
    """Split STEP arguments while preserving commas inside nested values."""
    result, current = [], []
    depth = 0
    quoted = False
    index = 0
    while index < len(value):
        char = value[index]
        if char == "'":
            current.append(char)
            if quoted and index + 1 < len(value) and value[index + 1] == "'":
                current.append("'")
                index += 1
            else:
                quoted = not quoted
        elif not quoted and char == "(":
            depth += 1
            current.append(char)
        elif not quoted and char == ")":
            depth -= 1
            current.append(char)
        elif not quoted and char == "," and depth == 0:
            result.append("".join(current).strip())
            current = []
        else:
            current.append(char)
        index += 1
    result.append("".join(current).strip())
    return result


def _label(value):
    if value.startswith("'") and value.endswith("'"):
        return value[1:-1].replace("''", "'").strip()
    return ""


def building_ifc():
    content = MODEL_PATH.read_bytes()
    records = {}
    for line in content.decode("utf-8-sig").splitlines():
        match = re.match(r"^#(\d+)\s*=\s*(IFC[A-Z0-9_]+)\((.*)\);$", line)
        if match:
            records[match.group(1)] = (match.group(2), _arguments(match.group(3)))

    storeys = {}
    for express_id, (kind, args) in records.items():
        if kind != "IFCBUILDINGSTOREY" or len(args) < 10:
            continue
        try:
            elevation = float(args[9])
        except ValueError:
            elevation = 0.0
        storeys[express_id] = (_label(args[2]) or "Niveau", elevation)

    element_storey = {}
    for kind, args in records.values():
        if kind != "IFCRELCONTAINEDINSPATIALSTRUCTURE" or len(args) < 6:
            continue
        structure = re.fullmatch(r"#(\d+)", args[5])
        if not structure or structure.group(1) not in storeys:
            continue
        level_name = storeys[structure.group(1)][0]
        for related in re.findall(r"#(\d+)", args[4]):
            element_storey[related] = level_name

    levels_by_elevation = [
        name for name, _ in sorted(storeys.values(), key=lambda item: item[1])
    ]
    products = []
    for express_id, (kind, args) in records.items():
        if kind not in PRODUCT_TYPES or len(args) < 7 or args[6] == "$":
            continue
        name = _label(args[2]) if len(args) > 2 else ""
        level = element_storey.get(express_id, "Éléments communs")
        if not name:
            name = f"{kind.removeprefix('IFC').replace('_', ' ').title()} #{express_id}"
        products.append((express_id, level, kind, name[:250]))

    level_order = {name: index for index, name in enumerate(levels_by_elevation)}
    level_order["Éléments communs"] = len(level_order)
    products.sort(key=lambda item: (level_order.get(item[1], len(level_order)), int(item[0])))
    if not products:
        raise ValueError("La maquette IFC de démonstration ne contient aucun élément exploitable.")
    return content, products
