import os
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
from tensorflow.keras.models import load_model

model_path = os.path.join(os.path.dirname(__file__), "parkinson_mobilenet_augmented.keras")
model = load_model(model_path)
with open('model_summary_clean.txt', 'w') as f:
    model.summary(print_fn=lambda x: f.write(x + '\n'))
