from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('recruitment', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql=[
                "DROP TABLE IF EXISTS recruitment_user_groups;",
                "DROP TABLE IF EXISTS recruitment_user_permissions;",
            ],
            reverse_sql=[
                """
                CREATE TABLE recruitment_user_groups (
                    id INTEGER PRIMARY KEY AUTOINCREMENT
                );
                """,
                """
                CREATE TABLE recruitment_user_permissions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT
                );
                """
            ]
        ),
    ]