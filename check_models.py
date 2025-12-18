import google.generativeai as genai

# PASTE YOUR KEY INSIDE THE QUOTES BELOW 👇
api_key = "AIzaSyBV4AS-cdPQ1z4NePHMJX_jz-CEhOTRF0k" 

if api_key == "AIzaSyBV4AS-cdPQ1z4NePHMJX_jz-CEhOTRF0k":
    print("❌ Please paste your actual Google API Key in the script code first!")
else:
    print(f"✅ Key loaded. Contacting Google...")
    genai.configure(api_key=api_key)

    try:
        print("\n--- AVAILABLE MODELS FOR YOU ---")
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(f"- {m.name}")
        print("--------------------------------")
    except Exception as e:
        print(f"❌ Error: {e}")