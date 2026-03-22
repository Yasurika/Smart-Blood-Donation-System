"""
SmartBlood AI Engine — Blood Demand Forecasting & Donor Risk Assessment
========================================================================
Python-based ML service for advanced analytics.

Features:
- Time-series demand forecasting per blood type
- Donor eligibility risk scoring with weighted factors
- Stock expiry prediction alerts
- Campaign impact prediction

Run: python src/ai/engine.py --serve (starts HTTP API on port 5050)
     python src/ai/engine.py --predict (one-shot prediction)
"""

import json
import sys
import math
from datetime import datetime, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any
import statistics

# ─── Constants ────────────────────────────────────────────────────────────────
BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

# Sri Lanka blood type distribution (approximate percentages)
SL_BLOOD_DISTRIBUTION = {
    'O+': 36.5, 'A+': 22.8, 'B+': 24.1, 'AB+': 7.2,
    'O-': 3.9,  'A-': 2.4,  'B-': 2.1,  'AB-': 1.0,
}

# Blood type compatibility for transfusion (who can receive from whom)
COMPATIBILITY = {
    'O-':  ['O-'],
    'O+':  ['O-', 'O+'],
    'A-':  ['O-', 'A-'],
    'A+':  ['O-', 'O+', 'A-', 'A+'],
    'B-':  ['O-', 'B-'],
    'B+':  ['O-', 'O+', 'B-', 'B+'],
    'AB-': ['O-', 'A-', 'B-', 'AB-'],
    'AB+': BLOOD_TYPES,  # Universal recipient
}


# ══════════════════════════════════════════════════════════════════════════════
# 1. DEMAND FORECASTING ENGINE
# ══════════════════════════════════════════════════════════════════════════════

class DemandForecaster:
    """
    Simple time-series forecasting using exponential smoothing.
    In production, this would use Prophet/ARIMA with real historical data.
    """

    def __init__(self, alpha: float = 0.3):
        self.alpha = alpha  # Smoothing factor

    def exponential_smoothing(self, series: list[float]) -> list[float]:
        """Apply simple exponential smoothing to a time series."""
        if not series:
            return []
        result = [series[0]]
        for i in range(1, len(series)):
            result.append(self.alpha * series[i] + (1 - self.alpha) * result[-1])
        return result

    def forecast(self, history: list[float], periods: int = 7) -> dict:
        """
        Forecast future demand based on historical data.
        Returns predictions, confidence intervals, and trend analysis.
        """
        if len(history) < 3:
            avg = statistics.mean(history) if history else 10
            return {
                'predictions': [round(avg)] * periods,
                'confidence_low': [max(0, round(avg * 0.7))] * periods,
                'confidence_high': [round(avg * 1.3)] * periods,
                'trend': 'insufficient_data',
                'seasonality': None,
            }

        smoothed = self.exponential_smoothing(history)
        last_smoothed = smoothed[-1]

        # Calculate trend (slope of last 5 points)
        recent = smoothed[-min(5, len(smoothed)):]
        if len(recent) >= 2:
            slope = (recent[-1] - recent[0]) / len(recent)
        else:
            slope = 0

        # Generate predictions
        predictions = []
        for i in range(1, periods + 1):
            pred = last_smoothed + slope * i
            # Add weekly seasonality (weekday effect)
            day_of_week = (datetime.now().weekday() + i) % 7
            seasonal_factor = 1.0 + (0.15 if day_of_week < 5 else -0.25)
            pred *= seasonal_factor
            predictions.append(max(0, round(pred)))

        # Confidence intervals
        std = statistics.stdev(history) if len(history) > 1 else predictions[0] * 0.2
        confidence_low = [max(0, round(p - 1.96 * std)) for p in predictions]
        confidence_high = [round(p + 1.96 * std) for p in predictions]

        # Trend classification
        if slope > 0.5:
            trend = 'increasing'
        elif slope < -0.5:
            trend = 'decreasing'
        else:
            trend = 'stable'

        return {
            'predictions': predictions,
            'confidence_low': confidence_low,
            'confidence_high': confidence_high,
            'trend': trend,
            'trend_slope': round(slope, 3),
            'seasonality': 'weekly',
        }

    def forecast_all_types(self, history_by_type: dict[str, list[float]], periods: int = 7) -> dict:
        """Forecast demand for all blood types."""
        results = {}
        total_demand = [0] * periods

        for blood_type in BLOOD_TYPES:
            type_history = history_by_type.get(blood_type, [])
            if not type_history:
                # Use distribution-based estimation
                base = SL_BLOOD_DISTRIBUTION.get(blood_type, 5) / 100 * 50
                type_history = [base + (base * 0.1 * (i % 3 - 1)) for i in range(14)]

            forecast = self.forecast(type_history, periods)
            results[blood_type] = forecast

            for i, pred in enumerate(forecast['predictions']):
                total_demand[i] += pred

        results['_total'] = {
            'predictions': total_demand,
            'trend': 'stable',
        }

        return results


# ══════════════════════════════════════════════════════════════════════════════
# 2. DONOR RISK SCORING ENGINE
# ══════════════════════════════════════════════════════════════════════════════

class DonorRiskAssessor:
    """
    Advanced multi-factor risk assessment with weighted scoring.
    Uses a decision-tree-like approach with configurable weights.
    """

    RISK_WEIGHTS = {
        'age': 0.10,
        'weight': 0.08,
        'hemoglobin': 0.15,
        'blood_pressure': 0.12,
        'donation_frequency': 0.10,
        'medical_history': 0.20,
        'medications': 0.10,
        'lifestyle': 0.08,
        'iron_stores': 0.07,
    }

    def assess(self, donor_data: dict) -> dict:
        """
        Comprehensive donor risk assessment.
        Returns a risk profile with category scores and recommendations.
        """
        scores = {}
        details = []

        # Age risk
        age = donor_data.get('age', 30)
        if 18 <= age <= 45:
            scores['age'] = 1.0
        elif 45 < age <= 55:
            scores['age'] = 0.85
        elif 55 < age <= 65:
            scores['age'] = 0.65
            details.append({'category': 'age', 'note': 'Higher age increases recovery time'})
        else:
            scores['age'] = 0.0
            details.append({'category': 'age', 'note': 'Age outside eligible range'})

        # Weight risk
        weight = donor_data.get('weight', 70)
        if weight >= 60:
            scores['weight'] = 1.0
        elif weight >= 55:
            scores['weight'] = 0.8
        elif weight >= 50:
            scores['weight'] = 0.6
            details.append({'category': 'weight', 'note': 'Borderline weight for safe donation'})
        else:
            scores['weight'] = 0.0
            details.append({'category': 'weight', 'note': 'Weight below minimum threshold'})

        # Hemoglobin
        hb = donor_data.get('hemoglobin')
        gender = donor_data.get('gender', 'male')
        min_hb = 13.0 if gender == 'male' else 12.5
        if hb is not None:
            if hb >= min_hb + 1:
                scores['hemoglobin'] = 1.0
            elif hb >= min_hb:
                scores['hemoglobin'] = 0.75
            elif hb >= min_hb - 0.5:
                scores['hemoglobin'] = 0.4
                details.append({'category': 'hemoglobin', 'note': f'Hemoglobin {hb} near cutoff'})
            else:
                scores['hemoglobin'] = 0.0
                details.append({'category': 'hemoglobin', 'note': f'Hemoglobin {hb} too low'})
        else:
            scores['hemoglobin'] = 0.7  # Unknown = moderate risk

        # Blood pressure
        sys_bp = donor_data.get('systolic', 120)
        dia_bp = donor_data.get('diastolic', 80)
        if 90 <= sys_bp <= 140 and 60 <= dia_bp <= 90:
            scores['blood_pressure'] = 1.0
        elif 80 <= sys_bp <= 160 and 50 <= dia_bp <= 100:
            scores['blood_pressure'] = 0.6
            details.append({'category': 'blood_pressure', 'note': f'BP {sys_bp}/{dia_bp} borderline'})
        else:
            scores['blood_pressure'] = 0.0
            details.append({'category': 'blood_pressure', 'note': f'BP {sys_bp}/{dia_bp} out of range'})

        # Donation frequency
        total_donations = donor_data.get('total_donations', 0)
        last_donation_days = donor_data.get('days_since_last', 365)
        min_gap = 56 if gender == 'male' else 84

        if last_donation_days >= min_gap:
            scores['donation_frequency'] = 1.0
        elif last_donation_days >= min_gap * 0.75:
            scores['donation_frequency'] = 0.5
            details.append({'category': 'donation_frequency', 'note': 'Close to minimum interval'})
        else:
            scores['donation_frequency'] = 0.0
            details.append({'category': 'donation_frequency', 'note': 'Too soon since last donation'})

        # Iron stores (estimated from donation history)
        if total_donations <= 2:
            scores['iron_stores'] = 1.0
        elif total_donations <= 5:
            scores['iron_stores'] = 0.85
        elif total_donations <= 10:
            scores['iron_stores'] = 0.7
            details.append({'category': 'iron_stores', 'note': 'Frequent donor — consider iron supplements'})
        else:
            scores['iron_stores'] = 0.6
            details.append({'category': 'iron_stores', 'note': 'Very frequent donor — monitor iron levels'})

        # Medical history
        diseases = donor_data.get('diseases', [])
        if not diseases:
            scores['medical_history'] = 1.0
        else:
            critical = ['hiv', 'hepatitis_b', 'hepatitis_c', 'cancer']
            manageable = ['diabetes', 'asthma', 'hypertension', 'thyroid']
            has_critical = any(d.lower() in critical for d in diseases)
            has_manageable = any(d.lower() in manageable for d in diseases)
            if has_critical:
                scores['medical_history'] = 0.0
            elif has_manageable:
                scores['medical_history'] = 0.4
            else:
                scores['medical_history'] = 0.7

        # Medications
        meds = donor_data.get('medications', [])
        if not meds:
            scores['medications'] = 1.0
        elif len(meds) <= 1:
            scores['medications'] = 0.7
        else:
            scores['medications'] = 0.4

        # Lifestyle factors
        lifestyle_score = 1.0
        if donor_data.get('recent_surgery'):
            lifestyle_score -= 0.4
        if donor_data.get('recent_tattoo'):
            lifestyle_score -= 0.3
        if donor_data.get('recent_travel'):
            lifestyle_score -= 0.15
        if donor_data.get('pregnancy'):
            lifestyle_score = 0.0
        scores['lifestyle'] = max(0, lifestyle_score)

        # Calculate weighted total
        total = sum(scores.get(k, 0.5) * v for k, v in self.RISK_WEIGHTS.items())
        total = round(total * 100, 1)

        # Classification
        if total >= 85:
            classification = 'LOW_RISK'
            recommendation = 'Excellent candidate for immediate donation'
        elif total >= 70:
            classification = 'MODERATE_RISK'
            recommendation = 'Eligible with minor considerations'
        elif total >= 50:
            classification = 'ELEVATED_RISK'
            recommendation = 'Requires medical review before donation'
        else:
            classification = 'HIGH_RISK'
            recommendation = 'Not recommended for donation at this time'

        return {
            'overall_score': total,
            'classification': classification,
            'recommendation': recommendation,
            'category_scores': {k: round(v * 100, 1) for k, v in scores.items()},
            'details': details,
            'weights': self.RISK_WEIGHTS,
        }


# ══════════════════════════════════════════════════════════════════════════════
# 3. STOCK ANALYTICS ENGINE
# ══════════════════════════════════════════════════════════════════════════════

class StockAnalyzer:
    """Analyzes blood stock levels and generates alerts."""

    # Minimum units per blood type to maintain safe supply (based on hospital size)
    SAFE_STOCK_LEVELS = {
        'O+': 30, 'A+': 25, 'B+': 25, 'AB+': 15,
        'O-': 20, 'A-': 15, 'B-': 15, 'AB-': 10,
    }

    def analyze(self, stock_data: dict[str, dict]) -> dict:
        """
        Analyze current stock levels and generate alerts.
        stock_data: { bloodType: { units: int, expiring_soon: int, avg_daily_usage: float } }
        """
        alerts = []
        summary = {}

        for bt in BLOOD_TYPES:
            data = stock_data.get(bt, {'units': 0, 'expiring_soon': 0, 'avg_daily_usage': 2})
            units = data.get('units', 0)
            safe_level = self.SAFE_STOCK_LEVELS[bt]
            avg_usage = max(0.1, data.get('avg_daily_usage', 2))
            expiring = data.get('expiring_soon', 0)

            # Days of supply remaining
            days_of_supply = round(units / avg_usage, 1) if units > 0 else 0

            # Stock status
            ratio = units / safe_level if safe_level > 0 else 0
            if ratio >= 1.5:
                status = 'surplus'
            elif ratio >= 1.0:
                status = 'adequate'
            elif ratio >= 0.5:
                status = 'low'
                alerts.append({
                    'type': 'LOW_STOCK',
                    'severity': 'warning',
                    'bloodType': bt,
                    'message': f'{bt} stock is at {units}/{safe_level} units ({round(ratio * 100)}%)',
                    'action': f'Initiate targeted donor outreach for {bt} donors',
                })
            else:
                status = 'critical'
                alerts.append({
                    'type': 'CRITICAL_STOCK',
                    'severity': 'critical',
                    'bloodType': bt,
                    'message': f'CRITICAL: {bt} stock at {units}/{safe_level} units. Only {days_of_supply} days supply remaining.',
                    'action': f'Emergency donor call-up for {bt}. Contact blood bank network.',
                })

            # Expiry alerts
            if expiring > 0 and expiring > units * 0.3:
                alerts.append({
                    'type': 'EXPIRY_WARNING',
                    'severity': 'warning',
                    'bloodType': bt,
                    'message': f'{expiring} units of {bt} expiring within 7 days ({round(expiring / units * 100)}% of stock)',
                    'action': f'Prioritize {bt} for transfusion or transfer to partnered facilities',
                })

            summary[bt] = {
                'units': units,
                'safe_level': safe_level,
                'status': status,
                'days_of_supply': days_of_supply,
                'expiring_soon': expiring,
                'fill_percentage': round(ratio * 100, 1),
            }

        # Sort alerts by severity
        severity_order = {'critical': 0, 'warning': 1, 'info': 2}
        alerts.sort(key=lambda a: severity_order.get(a.get('severity', 'info'), 2))

        return {
            'summary': summary,
            'alerts': alerts,
            'total_units': sum(s['units'] for s in summary.values()),
            'overall_status': 'critical' if any(a['severity'] == 'critical' for a in alerts) else
                            'warning' if any(a['severity'] == 'warning' for a in alerts) else 'healthy',
        }


# ══════════════════════════════════════════════════════════════════════════════
# 4. HTTP API SERVER (Optional — can also be called as module)
# ══════════════════════════════════════════════════════════════════════════════

class AIHandler(BaseHTTPRequestHandler):
    forecaster = DemandForecaster()
    risk_assessor = DonorRiskAssessor()
    stock_analyzer = StockAnalyzer()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 1_000_000:  # 1MB limit
            self.send_error(413, 'Request too large')
            return

        body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

        try:
            if self.path == '/api/forecast':
                result = self.forecaster.forecast_all_types(
                    body.get('history', {}),
                    body.get('periods', 7)
                )
            elif self.path == '/api/risk-assess':
                result = self.risk_assessor.assess(body)
            elif self.path == '/api/stock-analyze':
                result = self.stock_analyzer.analyze(body.get('stock', {}))
            elif self.path == '/api/health':
                result = {'status': 'ok', 'version': '2.0.0', 'engine': 'SmartBlood AI'}
            else:
                self.send_error(404, 'Endpoint not found')
                return

            response = json.dumps({'success': True, 'data': result})
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(response.encode())

        except Exception as e:
            error_response = json.dumps({'success': False, 'error': str(e)})
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(error_response.encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[SmartBlood AI] {args[0]}", file=sys.stderr)


def main():
    if '--serve' in sys.argv:
        port = int(sys.argv[sys.argv.index('--serve') + 1]) if len(sys.argv) > sys.argv.index('--serve') + 1 else 5050
        server = HTTPServer(('0.0.0.0', port), AIHandler)
        print(f"[SmartBlood AI Engine] Running on http://localhost:{port}")
        print(f"  POST /api/forecast      - Blood demand forecasting")
        print(f"  POST /api/risk-assess   - Donor risk assessment")
        print(f"  POST /api/stock-analyze - Stock level analysis")
        server.serve_forever()

    elif '--predict' in sys.argv:
        # Demo: run a sample prediction
        forecaster = DemandForecaster()
        sample_history = {
            'O+': [45, 42, 48, 50, 38, 44, 47, 52, 40, 43, 49, 51, 46, 48],
            'A+': [30, 28, 35, 32, 25, 31, 33, 36, 29, 30, 34, 37, 31, 33],
            'B+': [25, 22, 28, 30, 20, 24, 27, 31, 23, 25, 29, 32, 26, 28],
        }
        result = forecaster.forecast_all_types(sample_history, periods=7)
        print(json.dumps(result, indent=2))

        # Demo: risk assessment
        assessor = DonorRiskAssessor()
        sample_donor = {
            'age': 28, 'weight': 72, 'gender': 'male',
            'hemoglobin': 14.5, 'systolic': 118, 'diastolic': 76,
            'total_donations': 5, 'days_since_last': 120,
            'diseases': [], 'medications': [],
        }
        risk = assessor.assess(sample_donor)
        print(json.dumps(risk, indent=2))

    else:
        print("Usage:")
        print("  python engine.py --serve [port]  Start AI API server")
        print("  python engine.py --predict        Run demo prediction")


if __name__ == '__main__':
    main()
