# 数学阅读性能 fixture

这是一篇独立的数学公式性能 fixture。每个公式都使用不同变量，避免把一次重复渲染误认为完整的 KaTeX 压力；长公式用于观察窄屏幕下的局部溢出和公式容器。

## 公式章节 01

行内关系 $a_1^2+b_1^2=c_1^2$ 与块级公式共同出现。

$$a_1^2+b_1^2=c_1^2$$

## 公式章节 02

$$\sum_{k=1}^{n} k^2 = \frac{n(n+1)(2n+1)}{6}$$

## 公式章节 03

$$\int_{0}^{1} x^3\,dx = \frac{1}{4}$$

## 公式章节 04

$$\lim_{x\to 0}\frac{\sin x}{x}=1$$

## 公式章节 05

$$\nabla\cdot\mathbf{E}=\frac{\rho}{\varepsilon_0}$$

## 公式章节 06

$$\mathbf{F}=m\mathbf{a}+\lambda\mathbf{v}$$

## 公式章节 07

$$e^{i\theta}=\cos\theta+i\sin\theta$$

## 公式章节 08

$$\det(A-\lambda I)=0$$

## 公式章节 09

$$\left\|x-y\right\|_2^2=\sum_{i=1}^{d}(x_i-y_i)^2$$

## 公式章节 10

$$P(X=k)=\binom{n}{k}p^k(1-p)^{n-k}$$

## 公式章节 11

$$H(X)=-\sum_{i=1}^{m}p_i\log p_i$$

## 公式章节 12

$$\operatorname{Var}(X)=\mathbb{E}[X^2]-\mathbb{E}[X]^2$$

## 公式章节 13

$$\frac{d}{dx}\left(x^2e^x\right)=e^x(x^2+2x)$$

## 公式章节 14

$$\frac{\partial u}{\partial t}=\alpha\frac{\partial^2u}{\partial x^2}$$

## 公式章节 15

$$\oint_{\partial\Omega}\mathbf{F}\cdot d\mathbf{r}=\iint_{\Omega}\left(\nabla\times\mathbf{F}\right)\cdot\mathbf{n}\,dS$$

## 公式章节 16

$$\mu=\frac{1}{N}\sum_{i=1}^{N}x_i$$

## 公式章节 17

$$\sigma^2=\frac{1}{N}\sum_{i=1}^{N}(x_i-\mu)^2$$

## 公式章节 18

$$\hat{\beta}=(X^TX)^{-1}X^Ty$$

## 公式章节 19

$$L(\theta)=\prod_{i=1}^{N}p(y_i\mid x_i;\theta)$$

## 公式章节 20

$$\ell(\theta)=\sum_{i=1}^{N}\log p(y_i\mid x_i;\theta)$$

## 公式章节 21

$$D_{KL}(P\|Q)=\sum_xP(x)\log\frac{P(x)}{Q(x)}$$

## 公式章节 22

$$\operatorname{softmax}(z_i)=\frac{e^{z_i}}{\sum_{j=1}^{K}e^{z_j}}$$

## 公式章节 23

$$\operatorname{ReLU}(x)=\max(0,x)$$

## 公式章节 24

$$\sigma(x)=\frac{1}{1+e^{-x}}$$

## 公式章节 25

$$\mathcal{F}\{f(t)\}(\omega)=\int_{-\infty}^{\infty}f(t)e^{-i\omega t}\,dt$$

## 公式章节 26

$$\mathcal{L}\{f(t)\}(s)=\int_{0}^{\infty}f(t)e^{-st}\,dt$$

## 公式章节 27

$$\langle u,v\rangle=\sum_{i=1}^{n}u_iv_i$$

## 公式章节 28

$$\|x\|_p=\left(\sum_{i=1}^{n}|x_i|^p\right)^{1/p}$$

## 公式章节 29

$$\Pr(A\cap B)=\Pr(A)\Pr(B\mid A)$$

## 公式章节 30

$$\Pr(A\cup B)=\Pr(A)+\Pr(B)-\Pr(A\cap B)$$

## 公式章节 31

$$\mathbb{E}[g(X)]=\int_{-\infty}^{\infty}g(x)f_X(x)\,dx$$

## 公式章节 32

$$\frac{1}{\sqrt{2\pi\sigma^2}}\exp\left(-\frac{(x-\mu)^2}{2\sigma^2}\right)$$

## 公式章节 33：长公式

$$\mathcal{J}(\theta)=\frac{1}{N}\sum_{i=1}^{N}\left[-y_i\log\left(\frac{\exp\left(x_i^T\theta\right)}{1+\exp\left(x_i^T\theta\right)}\right)-\left(1-y_i\right)\log\left(1-\frac{\exp\left(x_i^T\theta\right)}{1+\exp\left(x_i^T\theta\right)}\right)\right]+\lambda\sum_{j=1}^{d}|\theta_j|$$

## 公式章节 34

$$\sum_{r=0}^{n}\binom{n}{r}x^ry^{n-r}=(x+y)^n$$

## 公式章节 35

$$\Gamma(z)=\int_{0}^{\infty}t^{z-1}e^{-t}\,dt$$

## 公式章节 36

$$\zeta(s)=\sum_{n=1}^{\infty}\frac{1}{n^s}$$
