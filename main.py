from db import create_tables, seed_dummy_data


def main():
    create_tables()
    seed_dummy_data()
    print("Supabase tables created via ORM.")


if __name__ == "__main__":
    main()
