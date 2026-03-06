import requests

url = 'http://127.0.0.1:5000/predict'
try:
    with open('dummy_image.jpg', 'rb') as f:
        files = {'file': ('dummy.jpg', f, 'image/jpeg')}
        print("Sending request to Flask...")
        response = requests.post(url, files=files)
        print("Response received:", response.status_code)
        print("Body:", response.text)
except Exception as e:
    print("Exception occurred:", type(e))
    import traceback
    traceback.print_exc()
