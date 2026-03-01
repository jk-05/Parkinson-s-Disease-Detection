import os
import logging
from pydub import AudioSegment
import librosa
import soundfile as sf
import imageio_ffmpeg

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_conversion():
    try:
        ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
        logger.info(f"FFmpeg path: {ffmpeg_path}")
        AudioSegment.converter = ffmpeg_path
        
        # Get one of the webm files from temp
        temp_dir = "temp"
        files = [f for f in os.listdir(temp_dir) if f.endswith(".webm")]
        if not files:
            logger.error("No webm files found in temp/")
            return
            
        original_path = os.path.join(temp_dir, files[0])
        wav_path = os.path.join(temp_dir, "test_output.wav")
        
        logger.info(f"Testing pydub with {original_path}...")
        try:
            sound = AudioSegment.from_file(original_path)
            sound.export(wav_path, format="wav")
            logger.info("Pydub conversion successful!")
        except Exception as e:
            logger.error(f"Pydub failed: {e}")
            
        logger.info(f"Testing librosa with {original_path}...")
        try:
            y, sr = librosa.load(original_path, sr=22050)
            sf.write(os.path.join(temp_dir, "test_librosa.wav"), y, sr)
            logger.info("Librosa conversion successful!")
        except Exception as e:
            logger.error(f"Librosa failed: {e}")

    except Exception as e:
        logger.error(f"General test error: {e}")

if __name__ == "__main__":
    test_conversion()
