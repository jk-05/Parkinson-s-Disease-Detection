import requests

url = 'http://127.0.0.1:5000/predict-voice'
try:
    with open('dummy_audio.wav', 'wb') as f:
        f.write(b'RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00')

    with open('dummy_audio.wav', 'rb') as f:
        files = {'file': ('dummy_audio.wav', f, 'audio/wav')}
        print("Sending request to Flask...")
        response = requests.post(url, files=files)
        print("Status Code:", response.status_code)
        print(response.text)
except requests.exceptions.RequestException as e:
    print("Network error:", e)
except Exception as e:
    print("Exception occurred:", type(e))
