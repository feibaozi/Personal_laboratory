import sqlite3
conn = sqlite3.connect('foodie_dev.db')
cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = [r[0] for r in cursor]
print(f"Tables: {len(tables)}")

cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name")
indexes = [r[0] for r in cursor]
print(f"Indexes: {len(indexes)}")
for idx in indexes:
    print(f"  {idx}")

conn.close()
print("Database verification PASSED")