
from django.core.management.base import BaseCommand

from STYLO.backend.wishlist.notification_services import check_all_alerts


class Command(BaseCommand):

    help = "Check price and stock alerts and send email notifications."

    def handle(self, *args, **options):

        self.stdout.write(
            self.style.WARNING("Checking STYLO customer alerts...")
        )

        result = check_all_alerts()

        self.stdout.write(
            self.style.SUCCESS(
                f"Price notifications sent: "
                f"{result['price_notifications_sent']}"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Stock notifications sent: "
                f"{result['stock_notifications_sent']}"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Total notifications sent: "
                f"{result['total_notifications_sent']}"
            )
        )
