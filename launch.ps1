Start-Process cmd -ArgumentList "/k cd /d C:\Users\HP\OneDrive\Desktop\VIGIL\Vigil && python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"
Start-Process cmd -ArgumentList "/k cd /d C:\Users\HP\OneDrive\Desktop\VIGIL\Vigil\frontend\login && npx serve . -l 3007"
Start-Process cmd -ArgumentList "/k cd /d C:\Users\HP\OneDrive\Desktop\VIGIL\Vigil\frontend\patient-app && npm run dev -- --port 3005"
Start-Process cmd -ArgumentList "/k cd /d C:\Users\HP\OneDrive\Desktop\VIGIL\Vigil\frontend\physician-dashboard && npm run dev -- --port 3008"