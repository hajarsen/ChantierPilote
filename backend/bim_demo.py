"""A small original IFC4 building, generated in metres for Banyra's demo."""
import uuid


def building_ifc():
    lines = []

    def add(entity):
        lines.append(f"#{len(lines) + 1}={entity};")
        return f"#{len(lines)}"

    def guid():
        # IFC GlobalId is a 128-bit value encoded in 22 base-64 digits.
        alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$"
        value = uuid.uuid4().int
        result = ""
        for _ in range(22):
            result = alphabet[value % 64] + result
            value //= 64
        return result

    origin = add("IFCCARTESIANPOINT((0.,0.,0.))")
    z = add("IFCDIRECTION((0.,0.,1.))")
    x = add("IFCDIRECTION((1.,0.,0.))")
    axes = add(f"IFCAXIS2PLACEMENT3D({origin},{z},{x})")
    place = add(f"IFCLOCALPLACEMENT($,{axes})")
    context = add(f"IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,{axes},$)")
    unit = add("IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)")
    units = add(f"IFCUNITASSIGNMENT(({unit}))")
    project = add(f"IFCPROJECT('{guid()}',$,'Banyra - Batiment exemple',$,$,$,$,({context}),{units})")
    site = add(f"IFCSITE('{guid()}',$,'Rabat - Demonstration',$,$,{place},$,$,.ELEMENT.,$,$,$,$,$)")
    building = add(f"IFCBUILDING('{guid()}',$,'Residence Al Manar',$,$,{place},$,$,.ELEMENT.,$,$,$)")
    add(f"IFCRELAGGREGATES('{guid()}',$,$,$,{project},({site}))")
    add(f"IFCRELAGGREGATES('{guid()}',$,$,$,{site},({building}))")
    floors = []
    products = []
    for level in range(3):
        floor = add(f"IFCBUILDINGSTOREY('{guid()}',$,'Niveau {level}',$,$,{place},$,$,.ELEMENT.,{level * 3.2})")
        floors.append(floor)
        members = []

        def box(kind, name, px, py, pz, width, depth, height, predefined):
            point = add(f"IFCCARTESIANPOINT(({px},{py},{pz}))")
            axis = add(f"IFCAXIS2PLACEMENT3D({point},{z},{x})")
            location = add(f"IFCLOCALPLACEMENT($,{axis})")
            profile = add(f"IFCRECTANGLEPROFILEDEF(.AREA.,$,$,{width},{depth})")
            solid = add(f"IFCEXTRUDEDAREASOLID({profile},{axes},{z},{height})")
            rep = add(f"IFCSHAPEREPRESENTATION({context},'Body','SweptSolid',({solid}))")
            shape = add(f"IFCPRODUCTDEFINITIONSHAPE($,$,({rep}))")
            entity = add(f"{kind}('{guid()}',$,'{name}',$,$,{location},{shape},$,.{predefined}.)")
            members.append(entity)
            products.append((entity[1:], level, kind))
            material = add("IFCMATERIAL('Beton arme',$,$)")
            add(f"IFCRELASSOCIATESMATERIAL('{guid()}',$,$,$,({entity}),{material})")

        elevation = level * 3.2
        box("IFCSLAB", f"Dalle niveau {level}", 0., 0., elevation, 14., 10., .25, "FLOOR")
        for col, (cx, cy) in enumerate([(-6., -4.), (0., -4.), (6., -4.), (-6., 4.), (0., 4.), (6., 4.)]):
            box("IFCCOLUMN", f"Poteau N{level}-{col + 1}", cx, cy, elevation + .25, .4, .4, 2.95, "COLUMN")
        for number, (px, py, width, depth) in enumerate([(0., -4.8, 14., .2), (0., 4.8, 14., .2), (-6.8, 0., .2, 9.4)]):
            box("IFCWALL", f"Voile N{level}-{number + 1}", px, py, elevation + .25, width, depth, 2.7, "STANDARD")
        add(f"IFCRELCONTAINEDINSPATIALSTRUCTURE('{guid()}',$,$,$,({','.join(members)}),{floor})")
    add(f"IFCRELAGGREGATES('{guid()}',$,$,$,{building},({','.join(floors)}))")
    content = "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('Banyra demo - donnees fictives'),'2;1');\nFILE_NAME('banyra-demo.ifc','',('Banyra'),('Banyra'),'Banyra','Banyra','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n" + "\n".join(lines) + "\nENDSEC;\nEND-ISO-10303-21;\n"
    return content.encode(), products
