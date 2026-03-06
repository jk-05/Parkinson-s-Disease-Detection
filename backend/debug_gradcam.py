import os
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
import numpy as np
from PIL import Image
from io import BytesIO
import tensorflow as tf
from tensorflow.keras.models import load_model
import cv2

model_path = os.path.join("d:\\Parkinson Disease Detection\\backend", "parkinson_mobilenet_augmented.keras")
model = load_model(model_path)

img = Image.fromarray(np.uint8(np.zeros((224, 224, 3))))
arr = np.expand_dims(np.array(img) / 255.0, axis=0)
preds = model.predict(arr, verbose=0)
idx = np.argmax(preds[0])

heatmap_base64 = None
try:
    # Find the last convolutional layer
    last_conv_layer_name = None
    # We must look through the inner model if this is a Sequential model containing MobileNet
    inner_model = model
    
    # Check if the model has a layer that is itself a Functional model (e.g. MobileNetV2)
    for layer in reversed(model.layers):
        if isinstance(layer, tf.keras.Model):
            inner_model = layer
            break
            
    for layer in reversed(inner_model.layers):
         if len(layer.output_shape) == 4:
             last_conv_layer_name = layer.name
             break

    print("Last conv layer:", last_conv_layer_name)

    if last_conv_layer_name:
         grad_model = tf.keras.models.Model(
             [inner_model.inputs], [inner_model.get_layer(last_conv_layer_name).output, inner_model.output]
         )

         with tf.GradientTape() as tape:
             # If inner_model is NOT the full model, we need to tape the whole model.
             pass

except Exception as e:
    import traceback
    traceback.print_exc()

# Let's just print the layers
print("Model Layers:", [l.name for l in model.layers])
if isinstance(model.layers[0], tf.keras.Model):
    print("Inner Model Layers:", [l.name for l in model.layers[0].layers][-5:])
