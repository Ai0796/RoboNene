import sys
import json
import numpy as np
import warnings
from sklearn.exceptions import ConvergenceWarning
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import Matern, DotProduct, WhiteKernel

# Suppress scikit-learn warnings to ensure clean JSON output
warnings.filterwarnings("ignore", category=ConvergenceWarning)
warnings.filterwarnings("ignore", category=RuntimeWarning)

def main():
    try:
        # 1. Read arguments from Node.js
        tier = str(sys.argv[1])
        is_world_bloom = sys.argv[2].lower() == 'true' # Optional flag for World Bloom events
        
        input_data = sys.stdin.read()
        if not input_data:
            raise ValueError("No data received via stdin")
            
        live_data = json.loads(input_data)
        
        # 2. Load the historical weights
        # Adjust this path if your weights.json is in a different relative location
        if is_world_bloom:
            weights_path = './JSONs/weights_world_bloom.json'
        else:
            weights_path = './JSONs/weights.json'
        with open(weights_path, 'r') as f:
            weights_data = json.load(f)
            
        if tier not in weights_data:
            raise ValueError(f"Tier {tier} not found in weights.json")
            
        xVals = np.array(weights_data[tier][0])
        predictions = np.array(weights_data[tier][1])
        stdDevs = np.array(weights_data[tier][2])
        
        # 3. Match live data to historical xVals and calculate Z-score residuals
        X_raw = []
        residuals_raw = []
        xValsIdx = 0
        
        for pt in live_data:
            x_val = pt['x']
            score = pt['y']
            
            if xValsIdx >= len(xVals) - 1:
                break
            
            while x_val > xVals[xValsIdx + 1]:
                xValsIdx += 1
                if xValsIdx >= len(xVals) - 1:
                    break
                
            if xValsIdx >= len(xVals) - 1:
                break
            
            if xVals[xValsIdx] <= x_val <= xVals[xValsIdx + 1]:
            
                X_raw.append(x_val)
                residuals_raw.append((score - predictions[xValsIdx]) / (stdDevs[xValsIdx] + 1e-6))
            
            xValsIdx += 1

        X_raw = np.array(X_raw)
        residuals_raw = np.array(residuals_raw)
        
        # 4. Downsample to max 100 points for performance (so the bot doesn't hang)
        if len(X_raw) > 100:
            sample_indices = np.linspace(0, len(X_raw) - 1, num=100, dtype=int)
            X_known = X_raw[sample_indices].reshape(-1, 1)
            residuals_known = residuals_raw[sample_indices]
        else:
            X_known = X_raw.reshape(-1, 1)
            residuals_known = residuals_raw
            
        # print(f"DEBUG: Using {len(X_known)} data points for GP regression from {len(X_raw)} total live data points.")
            
        # Increase length_scale to 0.7 to ignore short-term 'noise' and focus on the day-to-day trend.
        kernel_matern = Matern(length_scale=0.7, length_scale_bounds=(0.3, 1.0), nu=1.5)

        # Strictly limit the trend variance. 
        # sigma_0_bounds=(0.01, 1.0) prevents the MOE from exploding into the tens of millions.
        kernel_trend = DotProduct(sigma_0=0.1, sigma_0_bounds=(0.01, 1.0))

        # Slightly increase the assumed 'noise' level to 0.1
        # This tells the model: "If the points are a bit jagged, assume it's just jitter, not a trend shift."
        kernel_noise = WhiteKernel(noise_level=0.1, noise_level_bounds=(0.01, 0.5))

        kernel = kernel_matern + kernel_trend + kernel_noise
        
        gpr = GaussianProcessRegressor(kernel=kernel, n_restarts_optimizer=2, normalize_y=False)
        
        # 6. Fit and Predict
        if len(X_known) > 1:
            gpr.fit(X_known, residuals_known)
            predicted_residual, std_residual = gpr.predict([[1.0]], return_std=True)
            
            finalPrediction = predictions[-1] + predicted_residual[0] * stdDevs[-1]
            margin_of_error = 1.96 * std_residual[0] * stdDevs[-1]
        else:
            finalPrediction = predictions[-1]
            margin_of_error = 0
            
        final_point = np.max(X_known) if len(X_known) > 0 else 0
        time_remaining = max(0, 1.0 - final_point)
        margin_of_error *= (time_remaining) # Increase MOE if we're early in the event, decrease as we approach the end
            
        # 7. Print ONLY the JSON output for Node.js
        print(json.dumps({
            "estimate": float(finalPrediction),
            "error": float(margin_of_error)
        }))
        
    except Exception as e:
        print(json.dumps({"estimate": "Error", "error": str(e)}))

if __name__ == "__main__":
    main()