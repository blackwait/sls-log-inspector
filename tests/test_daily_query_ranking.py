import tempfile
import unittest
from pathlib import Path

from server import DailyQueryRanking


class DailyQueryRankingTest(unittest.TestCase):
    def test_records_daily_counts_and_rank_message(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            store_path = Path(tmp_dir) / "rankings.json"
            ranking = DailyQueryRanking(store_path)

            ranking.record_query("2026-06-05", "session-a", "张三", now=1000)
            ranking.record_query("2026-06-05", "session-a", "张三", now=1010)
            result = ranking.record_query("2026-06-05", "session-b", "李四", now=1020)

            self.assertEqual(result["current"]["count"], 1)
            self.assertEqual(result["ahead_count"], 1)
            self.assertEqual(result["message"], "您前面有1人，请多多使用")
            self.assertEqual(result["leaders"][0]["label"], "张三")
            self.assertEqual(result["leaders"][0]["count"], 2)

            leader_result = ranking.record_query("2026-06-05", "session-a", "张三", now=1030)
            self.assertEqual(leader_result["ahead_count"], 0)
            self.assertEqual(leader_result["message"], "您今日的查询次数已经遥遥领先")

    def test_resets_rank_by_day(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            store_path = Path(tmp_dir) / "rankings.json"
            ranking = DailyQueryRanking(store_path)

            ranking.record_query("2026-06-05", "session-a", "张三", now=1000)
            ranking.record_query("2026-06-06", "session-b", "李四", now=2000)
            result = ranking.record_query("2026-06-06", "session-a", "张三", now=2010)

            self.assertEqual(result["current"]["count"], 1)
            self.assertEqual(result["ahead_count"], 0)
            self.assertEqual(result["message"], "您今日的查询次数已经遥遥领先")


if __name__ == "__main__":
    unittest.main()
