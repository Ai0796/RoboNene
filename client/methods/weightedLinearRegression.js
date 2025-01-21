/**
*
* @param data [[x0,y0],[x2,y1],...]
* @param weights [w0,w1,...]
* @return {equation: number[]}
*/
const weightedLinearRegression = (data, weights) => {

    let sums = { w: 0, wx: 0, wx2: 0, wy: 0, wxy: 0 };

    // compute the weighted averages
    for (let i = 0; i < data.length; i++) {
        sums.w += weights[i];
        sums.wx += data[i][0] * weights[i];
        sums.wx2 += data[i][0] * data[i][0] * weights[i];
        sums.wy += data[i][1] * weights[i];
        sums.wxy += data[i][0] * data[i][1] * weights[i];
    }

    const denominator = sums.w * sums.wx2 - sums.wx * sums.wx;

    let gradient = (sums.w * sums.wxy - sums.wx * sums.wy) / denominator;
    let intercept = (sums.wy * sums.wx2 - sums.wx * sums.wxy) / denominator;
    let string = 'y = ' + Math.round(gradient * 100) / 100 + 'x + ' + Math.round(intercept * 100) / 100;

    return {equation: [gradient, intercept], string: string};
};

module.exports = weightedLinearRegression;