"""Original, private Moroccan sample data, stored once per Banyra account."""
import json
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo


def seed_portfolio(db, actor):
    existing = db.execute("SELECT id FROM projects WHERE owner_id=? AND is_demo=1 ORDER BY created_at DESC", (actor["id"],)).fetchall()
    if db.execute("SELECT 1 FROM demo_setups WHERE user_id=?", (actor["id"],)).fetchone():
        return [row["id"] for row in existing]
    today = datetime.now(ZoneInfo("Africa/Casablanca")).date()
    clock = datetime.now(timezone.utc)
    specs = [
        ("Résidence Al Manar", "Rabat", "Hay Riad, avenue Annakhil", "Logement", "18500000.00", "12400.00", "Atlas Immobilier", "Salma El Idrissi", "Youssef Bennani", "Bâtir Maroc"),
        ("Groupe scolaire Les Oliviers", "Casablanca", "Quartier Californie, Sidi Maârouf", "Équipement public", "24800000.00", "8600.00", "Fondation Les Oliviers", "Nadia Alaoui", "Mehdi Berrada", "Casa Construction"),
        ("Hôtel Jardin de l’Atlas", "Marrakech", "Route de l’Ourika, Agdal", "Hôtelier", "32600000.00", "15800.00", "Atlas Hospitalité", "Imane Tazi", "Amine El Fassi", "Sud Bâtiment"),
    ]
    ids = []
    for index, (name, city, address, project_type, budget, area, client, architect, manager, contractor) in enumerate(specs):
        pid = uuid.uuid4().hex
        ids.append(pid)
        stamp = (clock - timedelta(seconds=index)).isoformat()
        db.execute("""INSERT INTO projects
            (id,name,reference,city,client,budget,vat,start_date,owner_id,created_at,end_date,address,province,project_type,area,architect,engineering_office,contractor,site_manager,is_demo)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)""", (
            pid, name, f"MCH-{today.year}-{14 + index:03}", city, client, budget, "0",
            str(today - timedelta(days=120 - index * 25)), actor["id"], stamp,
            str(today + timedelta(days=260 + index * 40)), address, city, project_type,
            area, architect, "BET Atlas Conseil", contractor, manager))
        db.execute("INSERT INTO members VALUES(?,?,?)", (pid, actor["id"], "owner"))
        for person, role, company in [
            (architect, "Architecte", "Atelier d’architecture"),
            (manager, "Ingénieur travaux", contractor),
            ("Omar Aït Lahcen", "Chef de chantier", contractor),
            ("Khadija Mansouri", "Ingénieure BET", "BET Atlas Conseil"),
        ]:
            db.execute("INSERT INTO contacts VALUES(?,?,?,?,?)", (uuid.uuid4().hex, pid, person, role, company))
        tasks = [
            ("Réceptionner le ferraillage du voile V12", "quality", "Gros œuvre", "high", "doing", 1),
            ("Reprendre le relevé d’étanchéité en terrasse", "reserve", "Étanchéité", "urgent", "open", -1),
            ("Valider les attentes électriques du niveau R+2", "action", "Électricité", "normal", "doing", 3),
            ("Compléter les garde-corps de la trémie B", "safety", "Général", "urgent", "open", 0),
            ("Contrôler la planéité de la dalle R+1", "quality", "Gros œuvre", "normal", "done", -2),
            ("Confirmer la livraison des menuiseries", "action", "Menuiserie", "high", "open", 2),
        ]
        task_ids = []
        for title, kind, trade, priority, status, offset in tasks:
            tid = uuid.uuid4().hex
            task_ids.append(tid)
            checks = [{"label": label, "done": status == "done"} for label in ("Plan applicable vérifié", "Mise en œuvre contrôlée", "Écarts et photos consignés")] if kind in {"quality", "safety"} else []
            db.execute("INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (
                tid, pid, title, f"Intervenant terrain : {manager}. Exemple fictif à adapter au chantier réel.",
                kind, trade, actor["id"], str(today + timedelta(days=offset)), status,
                priority, json.dumps(checks), 1, actor["id"], stamp))

        def entry(kind, data):
            eid = uuid.uuid4().hex
            db.execute("INSERT INTO entries VALUES(?,?,?,?,?,?,?)", (eid, pid, kind, json.dumps(data, ensure_ascii=False), 1, actor["id"], stamp))
            return eid

        for days_ago in range(3):
            entry("diary", {
                "date": str(today - timedelta(days=days_ago)), "workforce": 42 + index * 7 - days_ago,
                "weather": "Ensoleillé, vent faible", "temperature": "18–25 °C",
                "workforce_detail": f"{contractor} : 18 coffreurs et 8 ferrailleurs\nÉlec Atlas : 6 électriciens\nPlomb Maroc : 4 plombiers\nEncadrement : {6 + index * 7 - days_ago} personnes",
                "work_zones": "Bloc A R+2 · Bloc B terrasse",
                "notes": ["Coulage de la dalle du bloc A terminé. Pose des relevés d’étanchéité du bloc B en cours.", "Ferraillage des voiles et pose des réservations techniques au R+2.", "Réception du support et implantation des cloisons du bloc A."][days_ago],
                "equipment": "Grue à tour GT-01 · Pompe à béton · 2 nacelles",
                "deliveries": "72 m³ béton C30/37 — BL 4581 à 4587 — conforme",
                "quality": "Éprouvettes prélevées par le laboratoire. Ferraillage visé avant coulage.",
                "safety": "Causerie travail en hauteur. Vérification des protections collectives.",
                "incidents": "Néant", "visitors": f"{architect} — architecte · Khadija Mansouri — BET",
                "decisions": f"{manager} : vérifier les réservations techniques avant le prochain coulage.",
                "blockers": "Menuiseries aluminium : livraison décalée de deux jours.",
                "next_day": "Décoffrage A2 · Réception étanchéité · Implantation cloisons R+1",
                "task_ids": task_ids[:2],
            })
        for title, amount, category, supplier in [
            ("Béton prêt à l’emploi C30/37", "86400.00", "Matériaux", "Béton Atlas"),
            ("Acier haute adhérence", "148500.00", "Matériaux", "Aciers du Maroc"),
            ("Location grue et nacelles", "28500.00", "Matériel", "Loca BTP Maroc"),
            ("Équipe coffrage — acompte", "42000.00", "Main-d’œuvre", contractor),
            ("Étanchéité terrasse — avancement", "36000.00", "Sous-traitance", "Étanche Maroc"),
        ]:
            entry("expense", {"title": title, "amount": str(Decimal(amount) + index * 1500), "category": category, "supplier": supplier, "date": str(today - timedelta(days=2))})
        contract = entry("contract", {"title": "Lot étanchéité et isolation", "partner": "Étanche Maroc", "reference": "ST-ET-003", "amount": "780000.00", "retention": "10", "payment_days": 60})
        entry("valuation", {"contract_id": contract, "period": today.strftime("%Y-%m"), "amount": "156000.00", "status": "approved", "retention_amount": "15600.00", "net_amount": "140400.00"})
        for title, supplier, quantity, price, amount, status in [
            ("Ciment CPJ 45 — sacs de 50 kg", "Matériaux du Centre", "120", "92.50", "11100.00", "ordered"),
            ("Panneaux de coffrage", "Atlas Coffrage", "80", "320.00", "25600.00", "received"),
        ]:
            entry("supply", {"title": title, "supplier": supplier, "quantity": quantity, "unit_price": price, "amount": amount, "delivery": str(today + timedelta(days=-3 if status == "received" else 2)), "status": status})
        entry("meeting", {"title": "Réunion hebdomadaire de chantier", "date": str(today - timedelta(days=2)), "participants": f"{architect}, {manager}, Omar Aït Lahcen, Khadija Mansouri", "notes": "Lever les réserves du bloc B. Confirmer la livraison des menuiseries. Diffuser le planning à trois semaines et le visa BET avant le prochain coulage."})
        db.execute("INSERT INTO events(project_id,user_id,description,created_at) VALUES(?,?,?,?)", (pid, actor["id"], "Démonstration : journal, dépenses et suivi terrain renseignés", stamp))
    db.execute("INSERT INTO demo_setups VALUES(?,?)", (actor["id"], clock.isoformat()))
    return ids
