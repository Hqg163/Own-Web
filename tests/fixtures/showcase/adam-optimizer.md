# 从梯度下降到 Adam：把“走多远”变成一个可学习的决定

> 优化器不是训练系统的装饰品。它决定参数如何读取梯度、积累历史以及在不同尺度上选择步长。本文用一条连续的推导线连接 SGD、Momentum、RMSProp 和 Adam。

## 一个最小的优化问题

设模型参数为 \(\theta\)，目标函数为 \(f(\theta)\)，第 \(t\) 步的梯度为 \(g_t=\nabla f(\theta_t)\)。最基础的梯度下降把参数向负梯度方向移动：

$$
\theta_{t+1}=\theta_t-\eta g_t
$$

其中 \(\eta\) 是学习率。它的优点是透明，缺点也很直接：当不同参数维度的梯度尺度差异很大时，一个统一学习率很难同时适合所有方向；当目标函数狭长或噪声较大时，路径会来回摆动。

## SGD：简单但不盲目

小批量 SGD 使用当前 batch 的估计梯度。它不是“低级版本”，而是一个很好的基线：实现简单，内存小，噪声有时还能帮助离开尖锐区域。工程上最重要的是记录学习率、batch size、梯度裁剪和验证集曲线，否则“优化器变好了”很可能只是训练预算变了。

## Momentum：保留方向感

Momentum 引入速度变量 \(m_t\)，让过去的梯度对当前步产生影响：

$$
m_t=\beta m_{t-1}+(1-\beta)g_t,\qquad \theta_{t+1}=\theta_t-\eta m_t
$$

当梯度方向稳定时，速度会累积；当方向反复改变时，历史会提供平滑作用。\(\beta\) 越大，记忆越长，但响应新梯度越慢。这个方法解决了部分震荡问题，却没有解决各参数维度尺度不同的问题。

## RMSProp：每个方向使用自己的尺度

RMSProp 维护梯度平方的指数移动平均 \(v_t\)：

$$
v_t=\rho v_{t-1}+(1-\rho)g_t^2,\qquad \theta_{t+1}=\theta_t-\eta\frac{g_t}{\sqrt{v_t}+\epsilon}
$$

大梯度方向的分母更大，步长会被压低；小梯度方向相对获得更大的有效步长。\(\epsilon\) 是数值稳定项，不能随意删除，因为当某个维度的二阶统计量接近零时，除法会放大误差。

| 优化器 | 记忆量 | 方向平滑 | 尺度自适应 | 主要代价 |
| --- | --- | --- | --- | --- |
| SGD | 无 | 否 | 否 | 对学习率敏感 |
| Momentum | 一阶矩 | 是 | 否 | 需要调 β |
| RMSProp | 二阶矩 | 间接 | 是 | 统计量初始化 |
| Adam | 一阶+二阶矩 | 是 | 是 | 可能偏好较大步长 |

## Adam：两个统计量合在一起

Adam 同时维护一阶矩和二阶矩：

$$
m_t=\beta_1m_{t-1}+(1-\beta_1)g_t,\qquad v_t=\beta_2v_{t-1}+(1-\beta_2)g_t^2
$$

因为初始状态通常是零，前几步的移动平均会偏向零，所以要做 bias correction：

$$
\hat m_t=\frac{m_t}{1-\beta_1^t},\qquad \hat v_t=\frac{v_t}{1-\beta_2^t}
$$

最终更新式为：

$$
\theta_{t+1}=\theta_t-\eta\frac{\hat m_t}{\sqrt{\hat v_t}+\epsilon}
$$

常用默认值并不是物理常数，应该根据任务验证。权重衰减也要区分 L2 正则和 decoupled weight decay；在现代框架中，AdamW 将权重衰减从梯度统计中解耦，不能把它们混为同一个开关。

```python
import torch

model = MyModel()
optimizer = torch.optim.Adam(
    model.parameters(), lr=3e-4, betas=(0.9, 0.999), eps=1e-8
)
for batch in loader:
    optimizer.zero_grad(set_to_none=True)
    loss = model.loss(batch)
    loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    optimizer.step()
```

## 读曲线而不是迷信默认值

如果训练 loss 降得很快而验证 loss 变坏，先检查数据切分、学习率和正则化，而不是直接换成 Adam。若 loss 震荡，降低学习率或增大 batch 可能比更换优化器更有解释力。若不同层的梯度量级相差几个数量级，观察梯度统计、归一化层和初始化，再判断 RMSProp/Adam 的自适应缩放是否真的解决了问题。

### 一个可复现的实验表

固定随机种子、数据顺序、epoch、学习率预算和模型初始化，只改变优化器。每次实验记录最终验证指标、最佳验证指标、达到阈值所需步数、峰值显存和每步耗时。只有这样，比较才不会把“更快收敛”和“更好泛化”混成一个结论。

[^adam]: Adam 的原始论文标题是 “Adam: A Method for Stochastic Optimization”；本文只复述公式结构和工程解释，不替代论文中的收敛条件与实验。

参考：[PyTorch Adam documentation](https://docs.pytorch.org/docs/main/generated/torch.optim.Adam.html)、[Adam paper](https://arxiv.org/abs/1412.6980)。

